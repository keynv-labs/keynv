export type { AuditEntry, AuditEventType, AuditInput } from './types.js';
export { GENESIS_HASH } from './types.js';
export {
  appendEntry,
  computeHash,
  verifyChain,
  type VerifyOptions,
  type VerifyResult,
} from './chain.js';
export { PAYLOAD_SCHEMAS, validateAuditPayload } from './payload-schemas.js';
