import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit/append.js';
import { signAccessToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from '../auth/tokens.js';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';
import { newOrgId, newUserId } from '../lib/id.js';
import { authedChain } from '../lib/middleware-chain.js';
import { ipRateLimitMiddleware } from '../lib/rate-limit.js';

interface AuthDeps {
  db: Db;
  jwtSecret: string;
  webUrl?: string | undefined;
  rateLimitPerMinute?: number | undefined;
  accessTtlS: number;
  refreshTtlS: number;
  /**
   * Whether POST /v1/auth/register is open. False by default — the
   * route still exists but returns rbac.denied so the frontend can
   * surface a clear "this instance doesn't allow public signup"
   * message without a 404 ambiguity.
   */
  publicRegistrationEnabled?: boolean;
  /**
   * Per-IP budget for POST /v1/auth/register. Defaults to 5/min via
   * loadEnv. Independent from rateLimitPerMinute (which is the
   * per-user authed-route budget).
   */
  registerRateLimitPerMinute?: number;
}

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshBody = z.object({
  refresh_token: z.string().min(1),
});

const LogoutBody = z.object({
  refresh_token: z.string().min(1).optional(),
});

const ChangePasswordBody = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(12).max(256),
});

const BrowserStartBody = z.object({
  device_name: z.string().min(1).max(120).optional(),
});

const BrowserPollBody = z.object({
  device_code: z.string().min(16).max(256),
});

const BrowserAuthorizeBody = z.object({
  user_code: z.string().min(8).max(32),
});

const RegisterBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(256),
  // Display name only — uniqueness is on user.email, not org.name.
  // Two orgs may share a display name without trouble.
  org_name: z.string().min(1).max(64),
});

const BROWSER_AUTH_TTL_S = 10 * 60;
const BROWSER_AUTH_INTERVAL_S = 2;
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function hashCode(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function newDeviceCode(): string {
  return randomBytes(32).toString('base64url');
}

function newUserCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (byte) => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

function normalizeUserCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function browserAuthorizeUrl(base: string, userCode: string): string {
  const url = new URL('/cli/authorize', base);
  url.searchParams.set('code', userCode);
  return url.toString();
}

export function authRoutes(deps: AuthDeps): Hono {
  const r = new Hono();

  // Public signup. Aggressive per-IP rate limit lives on this route
  // alone — the rest of /v1/auth (login/refresh/logout) follows the
  // existing pattern of being unrate-limited because failed attempts
  // are already mitigated by argon2id constant-time and audit-log
  // visibility. Register, by contrast, mutates state on every call,
  // so a flood would inflate the orgs table and burn KEK derivation
  // cycles.
  r.post(
    '/register',
    ipRateLimitMiddleware({ perMinute: deps.registerRateLimitPerMinute ?? 5 }),
    async (c) => {
      if (!deps.publicRegistrationEnabled) {
        return jsonError(c, 'rbac.denied', 'Public registration is not enabled on this instance.');
      }
      const parsed = RegisterBody.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) {
        return jsonError(
          c,
          'validation.failed',
          'Email, 12+ char password, and org name are required.',
        );
      }

      const existing = await deps.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, parsed.data.email))
        .limit(1);
      if (existing[0]) {
        return jsonError(c, 'user.already_exists', 'Email already registered.');
      }

      const orgId = newOrgId();
      const userId = newUserId();
      const password_hash = await hashPassword(parsed.data.password);

      // Atomic: if the user insert fails (rare race on the email
      // unique check), the org row still rolls back. better-sqlite3's
      // transaction wrapper is synchronous — see audit/append.ts and
      // routes/projects.ts for the same pattern.
      deps.db.transaction((tx) => {
        tx.insert(schema.orgs).values({ id: orgId, name: parsed.data.org_name }).run();
        tx.insert(schema.users)
          .values({
            id: userId,
            org_id: orgId,
            email: parsed.data.email,
            password_hash,
            org_role: 'owner',
          })
          .run();
      });

      const access = await signAccessToken(
        { sub: userId, email: parsed.data.email, org_id: orgId, org_role: 'owner' },
        { secret: deps.jwtSecret, ttlSeconds: deps.accessTtlS },
      );
      const refresh = await issueRefreshToken(deps.db, {
        user_id: userId,
        ttlSeconds: deps.refreshTtlS,
      });

      await appendAudit(deps.db, {
        actor_user_id: userId,
        actor_agent: readAgent(c),
        event_type: 'auth.register',
        payload: { email: parsed.data.email, org_id: orgId, org_name: parsed.data.org_name },
      });

      return c.json(
        {
          access_token: access,
          refresh_token: refresh.rawToken,
          expires_in: deps.accessTtlS,
          user: {
            id: userId,
            email: parsed.data.email,
            org_id: orgId,
            org_role: 'owner',
          },
        },
        201,
      );
    },
  );

  r.post('/cli/browser/start', async (c) => {
    const parsed = BrowserStartBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid browser auth body.');

    const deviceCode = newDeviceCode();
    const userCode = newUserCode();
    const expiresAt = new Date(Date.now() + BROWSER_AUTH_TTL_S * 1000).toISOString();
    const verificationUri = new URL('/cli/authorize', deps.webUrl ?? new URL(c.req.url).origin);

    await deps.db.insert(schema.cli_auth_flows).values({
      device_code_hash: hashCode(deviceCode),
      user_code_hash: hashCode(normalizeUserCode(userCode)),
      device_name: parsed.data.device_name ?? null,
      expires_at: expiresAt,
    });

    return c.json(
      {
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUri.toString(),
        verification_uri_complete: browserAuthorizeUrl(verificationUri.toString(), userCode),
        expires_in: BROWSER_AUTH_TTL_S,
        interval: BROWSER_AUTH_INTERVAL_S,
      },
      201,
    );
  });

  r.post('/cli/browser/poll', async (c) => {
    const parsed = BrowserPollBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success)
      return jsonError(c, 'validation.failed', 'Invalid browser auth poll body.');

    const rows = await deps.db
      .select()
      .from(schema.cli_auth_flows)
      .where(eq(schema.cli_auth_flows.device_code_hash, hashCode(parsed.data.device_code)))
      .limit(1);
    const flow = rows[0];
    if (!flow) return jsonError(c, 'validation.failed', 'Browser auth flow not found.');
    if (new Date(flow.expires_at).getTime() <= Date.now()) {
      return jsonError(c, 'validation.failed', 'Browser auth flow expired.');
    }
    if (flow.consumed_at)
      return jsonError(c, 'validation.failed', 'Browser auth flow already used.');
    if (!flow.authorized_at || !flow.user_id) return c.json({ status: 'pending' }, 202);

    const userRows = await deps.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, flow.user_id))
      .limit(1);
    const user = userRows[0];
    if (!user) return jsonError(c, 'auth.invalid_credentials', 'User not found.');

    await deps.db
      .update(schema.cli_auth_flows)
      .set({ consumed_at: new Date().toISOString() })
      .where(eq(schema.cli_auth_flows.device_code_hash, flow.device_code_hash));

    const access = await signAccessToken(
      {
        sub: user.id,
        email: user.email,
        org_id: user.org_id,
        org_role: user.org_role,
      },
      { secret: deps.jwtSecret, ttlSeconds: deps.accessTtlS },
    );
    const refresh = await issueRefreshToken(deps.db, {
      user_id: user.id,
      ttlSeconds: deps.refreshTtlS,
      device_fingerprint: flow.device_name ?? undefined,
    });

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'auth.login.allowed',
      payload: { email: user.email },
    });

    return c.json({
      access_token: access,
      refresh_token: refresh.rawToken,
      expires_in: deps.accessTtlS,
      user: {
        id: user.id,
        email: user.email,
        org_id: user.org_id,
        org_role: user.org_role,
      },
    });
  });

  r.post('/login', async (c) => {
    const parsed = LoginBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid login body.');

    const rows = await deps.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, parsed.data.email))
      .limit(1);
    const user = rows[0];

    // Run argon2 verify even on a missing user, with a dummy hash, to keep
    // timing constant. Argon2 rejects malformed hashes by returning false.
    const dummyHash =
      '$argon2id$v=19$m=19456,t=2,p=1$MAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const ok = await verifyPassword(user?.password_hash ?? dummyHash, parsed.data.password);

    if (!user || !ok) {
      await appendAudit(deps.db, {
        actor_user_id: user?.id ?? null,
        actor_agent: readAgent(c),
        event_type: 'auth.login.denied',
        payload: { email: parsed.data.email },
      });
      return jsonError(c, 'auth.invalid_credentials', 'Invalid email or password.');
    }

    const access = await signAccessToken(
      {
        sub: user.id,
        email: user.email,
        org_id: user.org_id,
        org_role: user.org_role,
      },
      { secret: deps.jwtSecret, ttlSeconds: deps.accessTtlS },
    );
    const refresh = await issueRefreshToken(deps.db, {
      user_id: user.id,
      ttlSeconds: deps.refreshTtlS,
    });

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'auth.login.allowed',
      payload: { email: user.email },
    });

    return c.json({
      access_token: access,
      refresh_token: refresh.rawToken,
      expires_in: deps.accessTtlS,
      user: {
        id: user.id,
        email: user.email,
        org_id: user.org_id,
        org_role: user.org_role,
      },
    });
  });

  r.post('/refresh', async (c) => {
    const parsed = RefreshBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid refresh body.');

    const result = await rotateRefreshToken(deps.db, {
      rawToken: parsed.data.refresh_token,
      ttlSeconds: deps.refreshTtlS,
    });
    if (!result) return jsonError(c, 'auth.token_revoked', 'Refresh token invalid or expired.');

    const userRows = await deps.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, result.user_id))
      .limit(1);
    const user = userRows[0];
    if (!user) return jsonError(c, 'auth.invalid_credentials', 'User not found.');

    const access = await signAccessToken(
      {
        sub: user.id,
        email: user.email,
        org_id: user.org_id,
        org_role: user.org_role,
      },
      { secret: deps.jwtSecret, ttlSeconds: deps.accessTtlS },
    );

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'auth.refresh',
      payload: {},
    });

    return c.json({
      access_token: access,
      refresh_token: result.rawToken,
      expires_in: deps.accessTtlS,
    });
  });

  r.post('/logout', async (c) => {
    const parsed = LogoutBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid logout body.');
    if (parsed.data.refresh_token) {
      await revokeRefreshToken(deps.db, parsed.data.refresh_token);
    }
    await appendAudit(deps.db, {
      actor_user_id: null,
      actor_agent: readAgent(c),
      event_type: 'auth.logout',
      payload: {},
    });
    return c.body(null, 204);
  });

  // POST /v1/auth/password — current user changes own password.
  // Verifies current_password, hashes new_password (argon2id), updates
  // the row, and revokes every other refresh token for the user so
  // any leaked sessions die. The caller's current session keeps
  // working until its access token expires; the next refresh will
  // require a fresh login since the rotated token is gone.
  const authedSubrouter = new Hono();
  authedSubrouter.use('*', ...authedChain(deps));
  authedSubrouter.post('/cli/browser/authorize', async (c) => {
    const me = c.var.user;
    const parsed = BrowserAuthorizeBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid browser auth code.');

    const rows = await deps.db
      .select()
      .from(schema.cli_auth_flows)
      .where(
        eq(
          schema.cli_auth_flows.user_code_hash,
          hashCode(normalizeUserCode(parsed.data.user_code)),
        ),
      )
      .limit(1);
    const flow = rows[0];
    if (!flow) return jsonError(c, 'validation.failed', 'Browser auth flow not found.');
    if (new Date(flow.expires_at).getTime() <= Date.now()) {
      return jsonError(c, 'validation.failed', 'Browser auth flow expired.');
    }
    if (flow.consumed_at)
      return jsonError(c, 'validation.failed', 'Browser auth flow already used.');
    if (flow.authorized_at) return c.body(null, 204);

    await deps.db
      .update(schema.cli_auth_flows)
      .set({ user_id: me.id, authorized_at: new Date().toISOString() })
      .where(eq(schema.cli_auth_flows.device_code_hash, flow.device_code_hash));

    return c.body(null, 204);
  });

  authedSubrouter.post('/password', async (c) => {
    const me = c.var.user;
    const parsed = ChangePasswordBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(c, 'validation.failed', 'Invalid body. New password must be 12+ chars.');
    }

    const rows = await deps.db
      .select({ id: schema.users.id, password_hash: schema.users.password_hash })
      .from(schema.users)
      .where(eq(schema.users.id, me.id))
      .limit(1);
    const row = rows[0];
    if (!row) return jsonError(c, 'auth.invalid_credentials', 'User not found.');

    const ok = await verifyPassword(row.password_hash, parsed.data.current_password);
    if (!ok) {
      await appendAudit(deps.db, {
        actor_user_id: me.id,
        actor_agent: readAgent(c),
        event_type: 'auth.password_change.denied',
        payload: {},
      });
      return jsonError(c, 'auth.invalid_credentials', 'Current password is incorrect.');
    }

    if (parsed.data.current_password === parsed.data.new_password) {
      return jsonError(c, 'validation.failed', 'New password must differ from current.');
    }

    const new_hash = await hashPassword(parsed.data.new_password);
    await deps.db
      .update(schema.users)
      .set({ password_hash: new_hash })
      .where(eq(schema.users.id, me.id));

    // Revoke every active refresh token for this user. Their current
    // access token still works until expiry, but any other device that
    // holds a refresh token is now locked out.
    await deps.db
      .update(schema.auth_refresh_tokens)
      .set({ revoked_at: new Date().toISOString() })
      .where(
        and(
          eq(schema.auth_refresh_tokens.user_id, me.id),
          isNull(schema.auth_refresh_tokens.revoked_at),
        ),
      );

    await appendAudit(deps.db, {
      actor_user_id: me.id,
      actor_agent: readAgent(c),
      event_type: 'auth.password_change.allowed',
      payload: {},
    });

    return c.body(null, 204);
  });

  r.route('/', authedSubrouter);

  return r;
}
