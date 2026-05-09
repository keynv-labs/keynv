/**
 * Encrypts CLI credentials at rest with a libsodium secretbox whose key
 * lives in the OS keychain (macOS Keychain / Windows Credential Manager
 * / libsecret on Linux). Closes audit finding B3 / CLAUDE.md rule #12.
 *
 * If no keychain backend is available (headless Linux without
 * libsecret, or container without a session bus), `requireKey` throws
 * a clear actionable error instead of falling back to plaintext.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Entry } from '@napi-rs/keyring';
import { crypto } from '@keynv/core';

const SERVICE = 'keynv-cli';
const KEY_ACCOUNT = 'credentials-key';

function defaultPath(): string {
  return process.env['KEYNV_CREDENTIALS_FILE'] ?? join(homedir(), '.keynv', 'credentials.enc');
}

function legacyPath(): string {
  return process.env['KEYNV_CREDENTIALS_FILE_LEGACY'] ?? join(homedir(), '.keynv', 'credentials.json');
}

function entry(): Entry {
  return new Entry(SERVICE, KEY_ACCOUNT);
}

async function loadOrCreateKey(): Promise<Uint8Array> {
  const e = entry();
  let stored: string | null;
  try {
    stored = e.getPassword();
  } catch (err) {
    throw new Error(
      `keynv: OS keychain unavailable (${err instanceof Error ? err.message : String(err)}). ` +
        'Install libsecret on Linux, or set KEYNV_DISABLE_KEYCHAIN=1 to use a (less secure) ' +
        'file-based key store.',
    );
  }
  if (stored) {
    return new Uint8Array(Buffer.from(stored, 'base64'));
  }
  const fresh = await crypto.generateKey();
  try {
    e.setPassword(Buffer.from(fresh).toString('base64'));
  } catch (err) {
    throw new Error(
      `keynv: failed to write key to OS keychain (${err instanceof Error ? err.message : String(err)}).`,
    );
  }
  return fresh;
}

export async function saveCredentialsBlob(plaintext: Uint8Array): Promise<string> {
  const key = await loadOrCreateKey();
  const sealed = await crypto.encryptSecret(Buffer.from(plaintext).toString('utf8'), key);
  const path = defaultPath();
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // [version=1][nonce 24][ciphertext]
  const header = Buffer.from([0x01]);
  const blob = Buffer.concat([
    header,
    Buffer.from(sealed.nonce),
    Buffer.from(sealed.ciphertext),
  ]);
  writeFileSync(path, blob, { mode: 0o600 });
  // Migrate: clear any legacy plaintext file so it can't be read later.
  const legacy = legacyPath();
  if (existsSync(legacy)) rmSync(legacy, { force: true });
  return path;
}

export async function loadCredentialsBlob(): Promise<Uint8Array | null> {
  const path = defaultPath();
  const legacy = legacyPath();

  // One-shot migration: read legacy plaintext, re-encrypt, then delete.
  if (!existsSync(path) && existsSync(legacy)) {
    const buf = readFileSync(legacy);
    await saveCredentialsBlob(new Uint8Array(buf));
    return new Uint8Array(buf);
  }

  if (!existsSync(path)) return null;

  const blob = readFileSync(path);
  if (blob.length < 1 + 24 + 16) return null;
  const version = blob[0];
  if (version !== 0x01) return null;
  const nonce = new Uint8Array(blob.subarray(1, 1 + 24));
  const ciphertext = new Uint8Array(blob.subarray(1 + 24));

  const key = await loadOrCreateKey();
  try {
    const plain = await crypto.decryptSecret({ ciphertext, nonce }, key);
    return new TextEncoder().encode(plain);
  } catch {
    // Tampered or wrong key — caller treats as "no creds, please re-login".
    return null;
  }
}

export function clearCredentialsFile(): void {
  const path = defaultPath();
  if (existsSync(path)) rmSync(path, { force: true });
  const legacy = legacyPath();
  if (existsSync(legacy)) rmSync(legacy, { force: true });
  // Best-effort: remove the OS keychain key as well so the next login
  // generates a fresh one.
  try {
    entry().deletePassword();
  } catch {
    /* ignore */
  }
}
