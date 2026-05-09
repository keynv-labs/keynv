export type {
  EntropyOptions,
  Match,
  Pattern,
  RedactionSummary,
  RedactOptions,
  RedactResult,
} from './types.js';
export { BUILTIN_PATTERNS, BUILTIN_LINE_PATTERNS } from './patterns.js';
export { redact } from './batch.js';
export { createRedactStream, type StreamingOptions } from './streaming.js';
export { findEntropyMatches, shannonEntropy } from './entropy.js';
