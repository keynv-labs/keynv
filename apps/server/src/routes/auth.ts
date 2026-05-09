import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { signAccessToken } from '../auth/jwt.js';
import { verifyPassword } from '../auth/password.js';
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from '../auth/tokens.js';
import { appendAudit } from '../audit/append.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';

interface AuthDeps {
  db: Db;
  jwtSecret: string;
  accessTtlS: number;
  refreshTtlS: number;
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

export function authRoutes(deps: AuthDeps): Hono {
  const r = new Hono();

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
    const dummyHash = '$argon2id$v=19$m=19456,t=2,p=1$MAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
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

  return r;
}
