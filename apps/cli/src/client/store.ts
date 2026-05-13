/**
 * Persists CLI auth state encrypted-at-rest. The on-disk file at
 * `~/.keynv/credentials.enc` carries [version=1][24-byte nonce][ciphertext];
 * the encryption key lives in the OS keychain (macOS Keychain / Windows
 * Credential Manager / libsecret on Linux). See secure-store.ts for the
 * crypto wiring.
 *
 * This closes audit finding B3 / CLAUDE.md rule #12. Reading the
 * credentials file off-disk yields ciphertext only; without the
 * keychain entry an attacker has nothing useful even with full
 * filesystem read access.
 */
import { clearCredentialsFile, loadCredentialsBlob, saveCredentialsBlob } from './secure-store.js';

export interface Credentials {
  auth_kind?: 'session' | 'cli_token';
  server_url: string;
  user_id: string;
  email: string;
  org_id: string;
  org_role: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
}

let cache: Credentials | null | undefined;

export async function loadCredentialsAsync(): Promise<Credentials | null> {
  if (cache !== undefined) return cache;
  const blob = await loadCredentialsBlob();
  if (!blob) {
    cache = null;
    return null;
  }
  try {
    cache = JSON.parse(new TextDecoder().decode(blob)) as Credentials;
  } catch {
    cache = null;
  }
  return cache;
}

/**
 * Synchronous wrapper retained for callers that need a single-value
 * result without rewriting their flow. Internally it does an
 * async-load on first call only and caches; subsequent calls hit the
 * cache. The cache is busted on save/clear.
 *
 * Note: the first call returns null until a save has happened or
 * loadCredentialsAsync has been awaited. New code should prefer
 * loadCredentialsAsync.
 */
export function loadCredentials(): Credentials | null {
  return cache ?? null;
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  const blob = new TextEncoder().encode(JSON.stringify(creds));
  await saveCredentialsBlob(blob);
  cache = creds;
}

export function clearCredentials(): boolean {
  const ok = clearCredentialsFile();
  cache = null;
  return ok;
}
