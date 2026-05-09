/**
 * A regex-based redaction pattern. Names are stable identifiers used
 * in audit logs and the `pattern_summary` returned to MCP callers.
 *
 * `multiline` patterns may span newlines (e.g., RSA private-key blocks).
 * They are NOT applied in streaming mode — only in batch — because
 * detecting them across chunk boundaries requires unbounded buffering.
 */
export interface Pattern {
  readonly name: string;
  readonly regex: RegExp;
  readonly multiline?: boolean;
  /** How to render the redaction string. Default: `<REDACTED:{name}>`. */
  readonly redactWith?: (matched: string) => string;
}

/**
 * Where a pattern was hit. Offsets are into the input string.
 *
 * `preview` is a tightly-bounded fragment (max 8 chars + `…`) — it lets
 * audit consumers eyeball "what kind of secret was this" without
 * exposing the full value. Never log the underlying matched string.
 */
export interface Match {
  readonly pattern: string;
  readonly start: number;
  readonly end: number;
  readonly preview: string;
}

export interface RedactResult {
  readonly text: string;
  readonly matches: ReadonlyArray<Match>;
}

export interface RedactOptions {
  /** Override the default pattern bank entirely. */
  patterns?: ReadonlyArray<Pattern>;
  /** Add patterns on top of the default bank. */
  extraPatterns?: ReadonlyArray<Pattern>;
  /** Exact-match strings to redact (e.g., known resolved values). */
  literals?: ReadonlyArray<string>;
  entropy?: EntropyOptions;
}

export interface EntropyOptions {
  /** Default true. Disable to skip the entropy detector entirely. */
  enabled?: boolean;
  /** Minimum token length to consider. Default 24. */
  minLength?: number;
  /** Minimum bits-per-character. Default 4.5. */
  minBitsPerChar?: number;
}

export interface RedactionSummary {
  totalMatches: number;
  byPattern: Record<string, number>;
}
