/**
 * CLI token issuance + validation. Same hashing scheme as refresh
 * tokens (SHA-256 of the raw bytes); the raw token is shown to the
 * caller exactly once at creation.
 */
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { newRefreshTokenId } from '../lib/id.js';

const TOKEN_PREFIX = 'kt_';

export function isCliToken(raw: string): boolean {
  return raw.startsWith(TOKEN_PREFIX);
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function newRawCliToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export interface IssueCliTokenArgs {
  user_id: string;
  name: string;
  /** Optional — null means no expiry. */
  expiresInSeconds?: number | null;
}

export interface IssuedCliToken {
  /** Raw token. Show to user once; never persisted. */
  rawToken: string;
  id: string;
  expires_at: string | null;
}

export async function issueCliToken(db: Db, args: IssueCliTokenArgs): Promise<IssuedCliToken> {
  const rawToken = newRawCliToken();
  const id = newRefreshTokenId().replace(/^rt_/, 'kt_');
  const expires_at =
    args.expiresInSeconds == null
      ? null
      : new Date(Date.now() + args.expiresInSeconds * 1000).toISOString();
  await db.insert(schema.cli_tokens).values({
    id,
    user_id: args.user_id,
    name: args.name,
    token_hash: hashToken(rawToken),
    expires_at,
  });
  return { rawToken, id, expires_at };
}

export interface ValidatedCliToken {
  token_id: string;
  user_id: string;
}

/**
 * Resolves a raw CLI token to its row. Returns null when unknown,
 * revoked, or expired. On success, bumps last_used_at.
 */
export async function validateCliToken(
  db: Db,
  rawToken: string,
): Promise<ValidatedCliToken | null> {
  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select({
      id: schema.cli_tokens.id,
      user_id: schema.cli_tokens.user_id,
      expires_at: schema.cli_tokens.expires_at,
    })
    .from(schema.cli_tokens)
    .where(
      and(
        eq(schema.cli_tokens.token_hash, tokenHash),
        isNull(schema.cli_tokens.revoked_at),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;

  // Best-effort touch — don't await on the request hot path more than
  // necessary. We do await here for consistency in tests; in production
  // hot paths a fire-and-forget could be acceptable, but this is cheap.
  await db
    .update(schema.cli_tokens)
    .set({ last_used_at: new Date().toISOString() })
    .where(eq(schema.cli_tokens.id, row.id));

  return { token_id: row.id, user_id: row.user_id };
}

export async function revokeCliToken(
  db: Db,
  args: { id: string; user_id: string },
): Promise<boolean> {
  const result = await db
    .update(schema.cli_tokens)
    .set({ revoked_at: new Date().toISOString() })
    .where(
      and(
        eq(schema.cli_tokens.id, args.id),
        eq(schema.cli_tokens.user_id, args.user_id),
        isNull(schema.cli_tokens.revoked_at),
      ),
    );
  // better-sqlite3 returns RunResult with `changes`; surface to caller.
  return (result as unknown as { changes?: number }).changes !== 0;
}
