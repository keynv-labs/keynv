import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

let cachedFileSecret: string | null = null;

/**
 * Loads (or generates + persists) the web secret from a file so a
 * single-command deploy needs no operator-provided secret while keeping
 * sessions + CSRF tokens valid across restarts. Path is
 * KEYNV_WEB_SESSION_SECRET_FILE (default /data/web-session.secret) and
 * must sit on a writable volume.
 */
function loadOrCreateSessionSecret(): string {
  const file = process.env.KEYNV_WEB_SESSION_SECRET_FILE || '/data/web-session.secret';
  try {
    if (existsSync(file)) {
      const persisted = readFileSync(file, 'utf8').trim();
      if (persisted.length >= 32) return persisted;
    }
    const fresh = randomBytes(48).toString('base64');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, fresh, { mode: 0o600 });
    return fresh;
  } catch (err) {
    throw new Error(
      `KEYNV_WEB_SESSION_SECRET is not set and the auto-generated secret file (${file}) is not writable. Set KEYNV_WEB_SESSION_SECRET (min 32 chars), or mount a writable volume at its directory. Cause: ${(err as Error).message}`,
    );
  }
}

/**
 * The single web secret, shared by cookie sealing (session.ts) and CSRF
 * token signing (csrf.ts). Precedence:
 *   1. KEYNV_WEB_SESSION_SECRET env (>= 32 chars)
 *   2. a persisted file (auto-generated in production)
 *   3. a dev/build fallback (never used in production)
 */
export function getSessionSecret(): string {
  const secret = process.env.KEYNV_WEB_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    if (!cachedFileSecret) cachedFileSecret = loadOrCreateSessionSecret();
    return cachedFileSecret;
  }
  // Dev/build fallback — never use in production.
  return 'dev-session-secret-32chars-minimum-length';
}
