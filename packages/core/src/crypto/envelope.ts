import { type SealedSecret, type SymmetricKey, type WrappedKey, KEY_BYTES, NONCE_BYTES } from './types.js';
import { loadSodium } from './sodium.js';

/**
 * Generates a fresh 32-byte symmetric key.
 *
 * Use for both the master KEK (held by the org owner, encrypts each
 * project's DEK) and per-project DEKs (encrypts secret values).
 */
export async function generateKey(): Promise<SymmetricKey> {
  const sodium = await loadSodium();
  return sodium.randombytes_buf(KEY_BYTES);
}

/**
 * Wraps a DEK with a KEK. Output is the ciphertext + the random nonce
 * used for this wrap operation; both are needed to unwrap.
 *
 * Throws if either key has the wrong length — typed inputs make this
 * a programmer-error indicator, not a user-facing failure.
 */
export async function wrapDek(dek: SymmetricKey, kek: SymmetricKey): Promise<WrappedKey> {
  if (dek.length !== KEY_BYTES) throw new Error('wrapDek: DEK must be 32 bytes');
  if (kek.length !== KEY_BYTES) throw new Error('wrapDek: KEK must be 32 bytes');
  const sodium = await loadSodium();
  const nonce = sodium.randombytes_buf(NONCE_BYTES);
  const ciphertext = sodium.crypto_secretbox_easy(dek, nonce, kek);
  return { ciphertext, nonce };
}

/**
 * Unwraps a DEK previously produced by `wrapDek`. Throws if
 * authentication fails (wrong KEK, tampered ciphertext, wrong nonce).
 */
export async function unwrapDek(wrapped: WrappedKey, kek: SymmetricKey): Promise<SymmetricKey> {
  if (kek.length !== KEY_BYTES) throw new Error('unwrapDek: KEK must be 32 bytes');
  if (wrapped.nonce.length !== NONCE_BYTES) throw new Error('unwrapDek: nonce must be 24 bytes');
  const sodium = await loadSodium();
  return sodium.crypto_secretbox_open_easy(wrapped.ciphertext, wrapped.nonce, kek);
}

/**
 * Encrypts a UTF-8 string secret value with the project's DEK. Each call
 * uses a fresh random nonce; identical plaintexts produce different
 * ciphertexts.
 */
export async function encryptSecret(value: string, dek: SymmetricKey): Promise<SealedSecret> {
  if (dek.length !== KEY_BYTES) throw new Error('encryptSecret: DEK must be 32 bytes');
  const sodium = await loadSodium();
  const nonce = sodium.randombytes_buf(NONCE_BYTES);
  const message = new TextEncoder().encode(value);
  const ciphertext = sodium.crypto_secretbox_easy(message, nonce, dek);
  return { ciphertext, nonce };
}

/**
 * Decrypts a sealed secret. Throws if authentication fails.
 *
 * The returned string is the plaintext value; callers must avoid logging
 * it. The decrypted bytes are decoded as UTF-8 and held only in the
 * caller's local variable; we don't pool or cache plaintexts here.
 */
export async function decryptSecret(sealed: SealedSecret, dek: SymmetricKey): Promise<string> {
  if (dek.length !== KEY_BYTES) throw new Error('decryptSecret: DEK must be 32 bytes');
  if (sealed.nonce.length !== NONCE_BYTES) throw new Error('decryptSecret: nonce must be 24 bytes');
  const sodium = await loadSodium();
  const plaintext = sodium.crypto_secretbox_open_easy(sealed.ciphertext, sealed.nonce, dek);
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}
