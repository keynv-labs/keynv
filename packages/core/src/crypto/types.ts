/**
 * A 32-byte symmetric key. Used for both KEKs (master key) and DEKs
 * (per-project data-encryption keys).
 *
 * Always wrap real key material in a `Uint8Array` rather than a string —
 * strings are immutable and cannot be reliably zeroed.
 */
export type SymmetricKey = Uint8Array;

/**
 * A wrapped (encrypted) DEK. Produced by `wrapDek(dek, kek)` and stored
 * in the `projects.dek_wrapped` column. Without the KEK that wrapped it,
 * the contents are unrecoverable.
 */
export interface WrappedKey {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
}

/**
 * An encrypted secret value. Produced by `encryptSecretBytes(value, dek)` or
 * the string compatibility wrapper `encryptSecret(value, dek)`, and stored in
 * the `secrets.ciphertext` / `secrets.nonce` columns.
 */
export interface SealedSecret {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
}

/**
 * Symmetric-key length used by libsodium's `crypto_secretbox`
 * (XSalsa20-Poly1305).
 */
export const KEY_BYTES = 32;

/**
 * Nonce length for `crypto_secretbox`. Each encryption draws a fresh
 * random nonce of this length.
 */
export const NONCE_BYTES = 24;
