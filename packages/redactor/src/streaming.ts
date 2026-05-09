import { Transform, type TransformCallback } from 'node:stream';
import { redact } from './batch.js';
import { BUILTIN_LINE_PATTERNS } from './patterns.js';
import type { RedactOptions } from './types.js';

/**
 * Hard cap on the in-memory line buffer. Subprocess output containing
 * an unterminated line (e.g., interactive prompts that don't print
 * \n) is flushed once the buffer reaches this size to avoid unbounded
 * memory growth. Default: 64 KB.
 */
const DEFAULT_BUFFER_LIMIT = 64 * 1024;

export interface StreamingOptions extends RedactOptions {
  /** Hard cap on per-line buffer. Default 64 KB. */
  bufferLimit?: number;
}

/**
 * Constructs a Transform stream that line-buffers input, runs each
 * complete line through `redact`, and emits the redacted line.
 *
 * Multi-line patterns from the builtin bank (RSA / PGP private keys)
 * are NOT applied here — by definition they span multiple lines, and
 * detecting them across chunk boundaries requires unbounded buffering.
 * The batch API handles those; for streaming, a private key spanning
 * many lines will leak unless the caller adds a custom matcher with
 * explicit windowing.
 *
 * Use case: piped between a privileged subprocess's stdout/stderr and
 * the AI agent's tool-output channel.
 */
export function createRedactStream(opts: StreamingOptions = {}): Transform {
  const lineOpts: RedactOptions = {
    patterns: opts.patterns ?? BUILTIN_LINE_PATTERNS,
    ...(opts.extraPatterns ? { extraPatterns: opts.extraPatterns } : {}),
    ...(opts.literals ? { literals: opts.literals } : {}),
    ...(opts.entropy ? { entropy: opts.entropy } : {}),
  };
  const bufferLimit = opts.bufferLimit ?? DEFAULT_BUFFER_LIMIT;
  let buf = '';

  function flushBufferThroughRedactor(): string {
    if (buf.length === 0) return '';
    const result = redact(buf, lineOpts);
    buf = '';
    return result.text;
  }

  return new Transform({
    transform(chunk: Buffer, _enc, cb: TransformCallback) {
      buf += chunk.toString('utf8');
      let out = '';
      let nl: number;
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic line iteration
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl + 1);
        buf = buf.slice(nl + 1);
        const result = redact(line, lineOpts);
        out += result.text;
      }
      // Force-flush if the unterminated tail grows past the buffer cap
      // (defends against unbounded line lengths from misbehaving tools).
      if (buf.length >= bufferLimit) {
        out += flushBufferThroughRedactor();
      }
      cb(null, out);
    },
    flush(cb: TransformCallback) {
      cb(null, flushBufferThroughRedactor());
    },
  });
}
