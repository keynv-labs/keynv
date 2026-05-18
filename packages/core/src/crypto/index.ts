export type { SealedSecret, SymmetricKey, WrappedKey } from './types.js';
export { KEY_BYTES, NONCE_BYTES } from './types.js';
export {
  decryptSecret,
  decryptSecretBytes,
  encryptSecret,
  encryptSecretBytes,
  generateKey,
  unwrapDek,
  withDecryptedSecretBytes,
  wrapDek,
} from './envelope.js';
export { zero } from './sodium.js';
