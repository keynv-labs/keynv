export type { SealedSecret, SymmetricKey, WrappedKey } from './types.js';
export { KEY_BYTES, NONCE_BYTES } from './types.js';
export {
  decryptSecret,
  encryptSecret,
  generateKey,
  unwrapDek,
  wrapDek,
} from './envelope.js';
export { zero } from './sodium.js';
