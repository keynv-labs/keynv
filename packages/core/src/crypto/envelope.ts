import { loadSodium, zero } from './sodium.js';
import {
  KEY_BYTES,
  NONCE_BYTES,
  type SealedSecret,
  type SymmetricKey,
  type WrappedKey,
} from './types.js';

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
 * Encrypts raw secret bytes with the project's DEK. Each call uses a fresh
 * random nonce; identical plaintexts produce different ciphertexts.
 *
 * The caller owns `plaintext` and must zero it after this function returns.
 */
export async function encryptSecretBytes(
  plaintext: Uint8Array,
  dek: SymmetricKey,
): Promise<SealedSecret> {
  if (dek.length !== KEY_BYTES) throw new Error('encryptSecretBytes: DEK must be 32 bytes');
  const sodium = await loadSodium();
  const nonce = sodium.randombytes_buf(NONCE_BYTES);
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, dek);
  return { ciphertext, nonce };
}

/**
 * Decrypts a sealed secret to raw bytes. Throws if authentication fails.
 *
 * The returned buffer contains plaintext. Callers must either zero it in a
 * `finally` block or use `withDecryptedSecretBytes`, which does that for them.
 */
export async function decryptSecretBytes(
  sealed: SealedSecret,
  dek: SymmetricKey,
): Promise<Uint8Array> {
  if (dek.length !== KEY_BYTES) throw new Error('decryptSecretBytes: DEK must be 32 bytes');
  if (sealed.nonce.length !== NONCE_BYTES) {
    throw new Error('decryptSecretBytes: nonce must be 24 bytes');
  }
  const sodium = await loadSodium();
  return sodium.crypto_secretbox_open_easy(sealed.ciphertext, sealed.nonce, dek);
}

/**
 * Decrypts secret bytes for the duration of a callback and then zeroes the
 * plaintext buffer even when the callback throws.
 */
export async function withDecryptedSecretBytes<T>(
  sealed: SealedSecret,
  dek: SymmetricKey,
  usePlaintext: (plaintext: Uint8Array) => T | Promise<T>,
): Promise<T> {
  const plaintext = await decryptSecretBytes(sealed, dek);
  try {
    return await usePlaintext(plaintext);
  } finally {
    zero(plaintext);
  }
}

/**
 * Encrypts a UTF-8 string secret value with the project's DEK.
 *
 * This compatibility wrapper zeroes its encoded byte buffer, but the input
 * string itself remains V8-managed and cannot be reliably wiped.
 */
export async function encryptSecret(value: string, dek: SymmetricKey): Promise<SealedSecret> {
  const plaintext = new TextEncoder().encode(value);
  try {
    return await encryptSecretBytes(plaintext, dek);
  } finally {
    zero(plaintext);
  }
}

/**
 * Decrypts a sealed secret to a UTF-8 string.
 *
 * This compatibility wrapper zeroes decrypted bytes after decoding, but the
 * returned string is V8-managed and cannot be reliably wiped by callers.
 */
export async function decryptSecret(sealed: SealedSecret, dek: SymmetricKey): Promise<string> {
  return withDecryptedSecretBytes(sealed, dek, (plaintext) =>
    new TextDecoder('utf-8', { fatal: true }).decode(plaintext),
  );
}
