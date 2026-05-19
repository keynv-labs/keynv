/**
 * A "text surface" is any file or directory where raw secret values
 * leak into plain text that humans or AI agents subsequently read.
 *
 * Examples: shell history files, Claude Code session JSONL transcripts,
 * Cursor logs, CI log dumps, copy-pasted command output.
 *
 * Surfaces have three operations:
 *  - `enumerate()` — list the concrete file paths this surface covers
 *    right now (re-globbed on each call because new sessions appear).
 *  - `scan()` — read-only retro scan that returns match counts +
 *    pattern previews per file. Never returns raw matched values.
 *  - `rewrite()` — Phase A Step 2; atomic file rewrite that replaces
 *    matched substrings with redaction tokens. Defined here so the
 *    interface is stable across phases; default implementations may
 *    throw in Step 1 builds.
 *
 * A surface's `scan()` returns *previews* and *counts*, never raw text.
 * Trust boundary: it is safe to print a `TextSurfaceScanResult` to a
 * terminal or to write it to disk.
 */

export interface TextSurfaceMatchPreview {
  /** Pattern name from `@keynv/redactor` (e.g., `aws-access-key-id`). */
  readonly pattern: string;
  /** 3-character preview from the redactor. Non-sensitive hint. */
  readonly preview: string;
}

export interface TextSurfaceFileScan {
  readonly path: string;
  /** Byte size of the file at scan time. Useful for the "is this big?" hint. */
  readonly bytes: number;
  /** Number of likely-secret matches in this file. */
  readonly matchCount: number;
  /** Up to `maxPreviewsPerFile` preview entries (default 5). */
  readonly previews: ReadonlyArray<TextSurfaceMatchPreview>;
  /**
   * Per-pattern match counts across the *entire* file (not just
   * previews). Used by `keynv doctor` to render a faithful histogram.
   */
  readonly patternCounts: Readonly<Record<string, number>>;
  /** True if the file exceeded `maxBytes` and was skipped. */
  readonly skipped?: boolean;
  /** Reason the file was skipped, if any. */
  readonly skipReason?: string;
}

export interface TextSurfaceScanResult {
  readonly surfaceId: string;
  readonly surfaceLabel: string;
  readonly files: ReadonlyArray<TextSurfaceFileScan>;
  readonly totalMatches: number;
  readonly totalBytes: number;
}

export interface ScanOptions {
  /**
   * Extra literal values to treat as secrets (e.g., resolved alias
   * values held by the watcher's fingerprint registry).
   */
  readonly literals?: ReadonlyArray<string>;
  /** Default true. Pass false to disable the entropy detector. */
  readonly entropy?: boolean;
  /** Per-file byte cap. Files larger than this are skipped. Default 50 MB. */
  readonly maxBytes?: number;
  /** Per-file preview cap. Default 5. */
  readonly maxPreviewsPerFile?: number;
  /** Per-surface file cap; surfaces with thousands of files are truncated. Default 5000. */
  readonly maxFilesPerSurface?: number;
}

export interface RewriteOptions {
  /** Write a `.keynv.bak.<ts>` backup before rewriting. Default true. */
  readonly backup?: boolean;
  /** Token to replace matches with. Default `<REDACTED:<pattern-name>>`. */
  readonly replacement?: string;
  /** Same scan options used to find matches; must be consistent across scan + rewrite. */
  readonly scanOptions?: ScanOptions;
  /**
   * Set true to rewrite even if the file looks like it's being actively
   * written to (mtime advanced in the last ~10 seconds). Off by default —
   * losing in-flight appends from another process is a real, hard-to-debug
   * failure mode.
   */
  readonly includeActive?: boolean;
  /** Compute the rewrite but don't actually modify the file. */
  readonly dryRun?: boolean;
}

export interface RewriteFileResult {
  readonly path: string;
  readonly matchCount: number;
  readonly bytesWritten: number;
  readonly backupPath?: string;
  readonly skipped?: boolean;
  readonly skipReason?: string;
}

export interface RewriteResult {
  readonly surfaceId: string;
  readonly files: ReadonlyArray<RewriteFileResult>;
  readonly totalMatchCount: number;
}

export interface TextSurface {
  readonly id: string;
  /** Human-readable name shown in `keynv doctor` output. */
  readonly label: string;
  /** Returns true if this surface exists at all on the current machine. */
  isPresent(): Promise<boolean>;
  enumerate(): Promise<ReadonlyArray<string>>;
  scan(options?: ScanOptions): Promise<TextSurfaceScanResult>;
  /**
   * Atomic rewrite. Not implemented in Phase A Step 1 — surfaces may
   * throw `RewriteNotImplementedError` until Step 2 lands.
   */
  rewrite(options?: RewriteOptions): Promise<RewriteResult>;
}

export class RewriteNotImplementedError extends Error {
  constructor(surfaceId: string) {
    super(
      `rewrite() not implemented for surface "${surfaceId}" yet. Track Phase A Step 2 (\`keynv scrub\`) for support.`,
    );
    this.name = 'RewriteNotImplementedError';
  }
}
