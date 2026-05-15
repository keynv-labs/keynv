import { and, desc, eq, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { issueCliToken, revokeCliToken } from '../auth/cli-tokens.js';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { jsonError } from '../lib/errors.js';
import { authedChain } from '../lib/middleware-chain.js';
import { audit, parseBody } from '../lib/route-utils.js';

interface CliTokenDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

const CreateBody = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/,
      'Name may only contain letters, digits, _ . - and spaces',
    ),
  /** Optional expiry in seconds. Omit for non-expiring tokens. */
  expires_in_seconds: z.coerce
    .number()
    .int()
    .positive()
    .max(5 * 365 * 24 * 3600)
    .optional(),
});

export function cliTokenRoutes(deps: CliTokenDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

  r.get('/', async (c) => {
    const me = c.var.user;
    const params = Object.fromEntries(new URL(c.req.url).searchParams);
    const limitRaw = Number(params.limit ?? 100);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? Math.floor(limitRaw) : 100;
    const beforeCreatedAt =
      typeof params.before_created_at === 'string' ? params.before_created_at : null;

    const conditions = [eq(schema.cli_tokens.user_id, me.id)];
    if (beforeCreatedAt) conditions.push(lt(schema.cli_tokens.created_at, beforeCreatedAt));

    const rows = await deps.db
      .select({
        id: schema.cli_tokens.id,
        name: schema.cli_tokens.name,
        created_at: schema.cli_tokens.created_at,
        last_used_at: schema.cli_tokens.last_used_at,
        expires_at: schema.cli_tokens.expires_at,
        revoked_at: schema.cli_tokens.revoked_at,
      })
      .from(schema.cli_tokens)
      .where(and(...conditions))
      .orderBy(desc(schema.cli_tokens.created_at))
      .limit(limit);

    const tail = rows.at(-1);
    const next_cursor = tail && rows.length === limit ? tail.created_at : null;
    return c.json({ tokens: rows, next_cursor });
  });

  r.post('/', async (c) => {
    const me = c.var.user;
    const parsed = await parseBody(c, CreateBody, 'Invalid token body.');
    if ('errorResponse' in parsed) return parsed.errorResponse;
    const issued = await issueCliToken(deps.db, {
      user_id: me.id,
      name: parsed.data.name,
      expiresInSeconds: parsed.data.expires_in_seconds ?? null,
    });
    await audit(c, deps.db, 'cli_token.created', { token_id: issued.id, name: parsed.data.name });
    return c.json(
      {
        id: issued.id,
        name: parsed.data.name,
        token: issued.rawToken,
        expires_at: issued.expires_at,
      },
      201,
    );
  });

  r.delete('/:id', async (c) => {
    const me = c.var.user;
    const id = c.req.param('id');
    // Look up the token name for the audit payload before revoking.
    const rows = await deps.db
      .select({ name: schema.cli_tokens.name })
      .from(schema.cli_tokens)
      .where(and(eq(schema.cli_tokens.id, id), eq(schema.cli_tokens.user_id, me.id)))
      .limit(1);
    const name = rows[0]?.name;
    if (!name) return jsonError(c, 'cli_token.not_found', 'Token not found.');

    const revoked = await revokeCliToken(deps.db, { id, user_id: me.id });
    if (!revoked) return jsonError(c, 'cli_token.not_found', 'Token already revoked.');

    await audit(c, deps.db, 'cli_token.revoked', { token_id: id, name });
    return c.body(null, 204);
  });

  return r;
}
