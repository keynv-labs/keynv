/**
 * Persists CLI auth state in `~/.keynv/credentials.json` with mode 0600.
 *
 * Phase 1 stores plain JSON because we don't yet have an OS-keychain
 * abstraction. Phase 2 task #30 wraps this in age-sealed encryption with
 * the key in macOS Keychain / Windows Credential Manager / libsecret.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface Credentials {
  server_url: string;
  user_id: string;
  email: string;
  org_id: string;
  org_role: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
}

function defaultPath(): string {
  return process.env['KEYNV_CREDENTIALS_FILE'] ?? join(homedir(), '.keynv', 'credentials.json');
}

export function loadCredentials(path: string = defaultPath()): Credentials | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: Credentials, path: string = defaultPath()): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function clearCredentials(path: string = defaultPath()): void {
  if (existsSync(path)) rmSync(path, { force: true });
}
