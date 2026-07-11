import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Resolves the JWT signing secret. Precedence:
 *   1. An explicit KEYNV_JWT_SECRET env value (>= 32 chars).
 *   2. A previously persisted secret at `path`.
 *   3. A freshly generated 48-byte base64 secret, written to `path`
 *      with mode 0600 so it survives restarts.
 *
 * Auto-generation lets a single-command deploy come up with zero
 * operator-provided secrets, while persisting to disk keeps every
 * issued session token valid across container restarts (the file is
 * the source of truth once created).
 */
export function resolveJwtSecret(opts: { envValue?: string | undefined; path: string }): string {
  const fromEnv = opts.envValue?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (existsSync(opts.path)) {
    const persisted = readFileSync(opts.path, 'utf8').trim();
    if (persisted.length >= 32) return persisted;
  }

  const fresh = randomBytes(48).toString('base64');
  writeFileSync(opts.path, fresh, { mode: 0o600 });
  try {
    chmodSync(opts.path, 0o600);
  } catch {
    // best-effort on platforms that don't support chmod
  }
  return fresh;
}
