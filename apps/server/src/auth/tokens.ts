import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { newRefreshTokenId } from '../lib/id.js';

export interface IssuedRefresh {
  /** Raw token string returned to the client. NEVER persisted. */
  rawToken: string;
  /** Database row id. */
  id: string;
  /** ISO timestamp of expiry. */
  expires_at: string;
}

interface IssueArgs {
  user_id: string;
  ttlSeconds: number;
  device_fingerprint?: string | undefined;
}

function hashToken(raw: string): string {
  return createHash('sha256')
    .update('keynv-refresh-token-v1:', 'utf8')
    .update(raw, 'utf8')
    .digest('hex');
}

function newRawToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function issueRefreshToken(db: Db, args: IssueArgs): Promise<IssuedRefresh> {
  const rawToken = newRawToken();
  const id = newRefreshTokenId();
  const expires_at = new Date(Date.now() + args.ttlSeconds * 1000).toISOString();
  await db.insert(schema.auth_refresh_tokens).values({
    id,
    user_id: args.user_id,
    token_hash: hashToken(rawToken),
    device_fingerprint: args.device_fingerprint ?? null,
    expires_at,
  });
  return { rawToken, id, expires_at };
}

/**
 * Validates a refresh token, rotates it (revokes the old, issues a
 * new one), and returns the new raw token. Returns null if the token
 * is unknown, expired, or already revoked.
 */
export async function rotateRefreshToken(
  db: Db,
  args: { rawToken: string; ttlSeconds: number },
): Promise<{ user_id: string; rawToken: string; expires_at: string } | null> {
  const tokenHash = hashToken(args.rawToken);
  const rows = await db
    .select()
    .from(schema.auth_refresh_tokens)
    .where(
      and(
        eq(schema.auth_refresh_tokens.token_hash, tokenHash),
        isNull(schema.auth_refresh_tokens.revoked_at),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  await db
    .update(schema.auth_refresh_tokens)
    .set({ revoked_at: new Date().toISOString() })
    .where(eq(schema.auth_refresh_tokens.id, row.id));

  const issued = await issueRefreshToken(db, {
    user_id: row.user_id,
    ttlSeconds: args.ttlSeconds,
    device_fingerprint: row.device_fingerprint ?? undefined,
  });
  return {
    user_id: row.user_id,
    rawToken: issued.rawToken,
    expires_at: issued.expires_at,
  };
}

export async function revokeRefreshToken(db: Db, rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db
    .update(schema.auth_refresh_tokens)
    .set({ revoked_at: new Date().toISOString() })
    .where(
      and(
        eq(schema.auth_refresh_tokens.token_hash, tokenHash),
        isNull(schema.auth_refresh_tokens.revoked_at),
      ),
    );
}
