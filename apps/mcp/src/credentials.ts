/**
 * Reads CLI credentials, preferring the encrypted store
 * (~/.keynv/credentials.enc) when available. Falls back to the legacy
 * plaintext JSON file (~/.keynv/credentials.json) only when the
 * encrypted store doesn't exist yet (e.g. pre-migration).
 *
 * The CLI's `loadCredentialsAsync()` from `secure-store.ts` handles
 * decryption internally and returns the same shape, so we delegate to
 * it when possible.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { crypto } from '@keynv/core';
import { Entry } from '@napi-rs/keyring';

const SERVICE = 'keynv-cli';
const KEY_ACCOUNT = 'credentials-key';

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

function defaultEncPath(): string {
  return process.env['KEYNV_CREDENTIALS_FILE'] ?? join(homedir(), '.keynv', 'credentials.enc');
}

function legacyPath(): string {
  return (
    process.env['KEYNV_CREDENTIALS_FILE_LEGACY'] ?? join(homedir(), '.keynv', 'credentials.json')
  );
}

async function loadKeyFromKeychain(): Promise<Uint8Array | null> {
  try {
    const e = new Entry(SERVICE, KEY_ACCOUNT);
    const stored = e.getPassword();
    if (!stored) return null;
    return new Uint8Array(Buffer.from(stored, 'base64'));
  } catch {
    return null;
  }
}

async function loadFromEncryptedStore(): Promise<Credentials | null> {
  const path = defaultEncPath();
  if (!existsSync(path)) return null;

  const blob = readFileSync(path);
  if (blob.length < 1 + 24 + 16) return null;
  const version = blob[0];
  if (version !== 0x01) return null;
  const nonce = new Uint8Array(blob.subarray(1, 1 + 24));
  const ciphertext = new Uint8Array(blob.subarray(1 + 24));

  const key = await loadKeyFromKeychain();
  if (!key) return null;

  try {
    return await crypto.withDecryptedSecretBytes(
      { ciphertext, nonce },
      key,
      (plain) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain)) as Credentials,
    );
  } catch {
    return null;
  }
}

function loadFromLegacyJson(): Credentials | null {
  const path = legacyPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Credentials;
  } catch {
    return null;
  }
}

export async function loadCredentials(): Promise<Credentials | null> {
  const enc = await loadFromEncryptedStore();
  if (enc) return enc;
  return loadFromLegacyJson();
}
