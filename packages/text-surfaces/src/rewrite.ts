import { constants } from 'node:fs';
import { copyFile, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type RedactOptions, redact } from '@keynv/redactor';
import type { RewriteFileResult, RewriteOptions, ScanOptions } from './types.js';

/**
 * Internal per-file metadata a surface passes to {@link rewriteFile}.
 * Not part of the public {@link RewriteOptions} so callers of a surface's
 * `rewrite()` can't accidentally disable the streaming-surface safety.
 */
export interface RewriteFileMeta {
  /**
   * True for append-only surfaces (shell history) where each entry is a
   * single atomic line. Exempts the file from the active-write skip.
   */
  readonly appendOnly?: boolean;
}

/**
 * How recently the file's mtime must NOT have advanced for us to feel
 * safe rewriting it. Claude Code and similar tools append to JSONL
 * session files as they stream, so a file touched in the last
 * `ACTIVE_WRITE_WINDOW_MS` is likely still being written to. Skip
 * with a clear `skipReason` unless the caller passes
 * `RewriteOptions.includeActive: true`.
 *
 * 10s is conservative — long enough to catch most live streams,
 * short enough that closed sessions are processed normally.
 */
const ACTIVE_WRITE_WINDOW_MS = 10_000;

/** Match-the-same prefix list scan.ts uses; keeps rewrite + scan consistent. */
const SURFACE_ENTROPY_EXCLUDE_PREFIXES: ReadonlyArray<string> = [
  'sha1-',
  'sha256:',
  'sha256-',
  'sha384-',
  'sha512-',
  '/',
  './',
  '../',
  '~/',
  'http://',
  'https://',
  'file://',
];

/**
 * Atomically rewrite `path` so that every secret-shaped substring is
 * replaced with the redaction token. Semantics:
 *
 *  1. Read file.
 *  2. Run the redactor against its contents (same options as scan, so
 *     match counts match what `keynv doctor` reported).
 *  3. If no matches → no-op (file untouched), return matchCount: 0.
 *  4. Write a `${path}.keynv.bak.<ts>` backup (unless backup: false).
 *  5. Write the redacted content to `${path}.keynv.tmp.<ts>`, fsync,
 *     `rename` over the original. POSIX-atomic on the same filesystem.
 *
 * JSONL safety: the default redaction token `<REDACTED:foo>` contains
 * only characters valid inside a JSON string, and the pattern bank's
 * regexes never include `"` in a match. So JSONL files (Claude Code
 * transcripts) survive raw-text rewrite as valid JSONL.
 */
export async function rewriteFile(
  path: string,
  options: RewriteOptions = {},
  meta: RewriteFileMeta = {},
): Promise<RewriteFileResult> {
  let mtimeMs = 0;
  try {
    const st = await stat(path);
    mtimeMs = st.mtimeMs;
  } catch (err) {
    return {
      path,
      matchCount: 0,
      bytesWritten: 0,
      skipped: true,
      skipReason: (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'stat-failed',
    };
  }

  // The active-write skip exists to avoid clobbering an in-flight *stream*
  // (Claude Code / Cursor append JSONL as they run). Append-only surfaces
  // like shell history are different: each entry is a single atomic line,
  // and — crucially — running `keynv scrub` itself bumps the history
  // mtime (the shell records the command), so a blanket 10s skip would
  // always skip the very history file the user just asked to clean. Exempt
  // append-only surfaces; streaming surfaces still honor the window.
  if (!options.includeActive && !meta.appendOnly && Date.now() - mtimeMs < ACTIVE_WRITE_WINDOW_MS) {
    return {
      path,
      matchCount: 0,
      bytesWritten: 0,
      skipped: true,
      skipReason: 'actively-written (pass --include-active to override)',
    };
  }

  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    return {
      path,
      matchCount: 0,
      bytesWritten: 0,
      skipped: true,
      skipReason: `read-failed: ${(err as Error).message}`,
    };
  }

  const scanOpts: ScanOptions = options.scanOptions ?? {};
  const redactOpts: RedactOptions = {
    entropy:
      scanOpts.entropy === false
        ? { enabled: false }
        : { excludePrefixes: SURFACE_ENTROPY_EXCLUDE_PREFIXES },
  };
  if (scanOpts.literals && scanOpts.literals.length > 0) {
    redactOpts.literals = scanOpts.literals;
  }

  const result = redact(raw, redactOpts);
  if (result.matches.length === 0) {
    return {
      path,
      matchCount: 0,
      bytesWritten: 0,
    };
  }

  // Custom replacement token? Re-render the redaction with the user's
  // chosen string instead of `<REDACTED:foo>`. We do this by replacing
  // every match site right-to-left in the original `raw`.
  const replacement = options.replacement;
  const redactedText =
    replacement === undefined
      ? result.text
      : (() => {
          // Sort by start ascending; we already have non-overlapping matches.
          const matches = [...result.matches].sort((a, b) => a.start - b.start);
          let out = raw;
          for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            if (!m) continue;
            out = out.slice(0, m.start) + replacement + out.slice(m.end);
          }
          return out;
        })();

  if (options.dryRun) {
    return {
      path,
      matchCount: result.matches.length,
      bytesWritten: 0,
    };
  }

  const ts = isoCompact(new Date());
  let backupPath: string | undefined;
  if (options.backup !== false) {
    try {
      // Second-resolution stamp collides for a second scrub of the same file
      // within the same second; COPYFILE_EXCL + counter never clobbers an
      // earlier backup (AUDIT-FINDINGS-4 Y3).
      backupPath = await backupWithoutClobber(path, `${path}.keynv.bak.${ts}`);
    } catch (err) {
      return {
        path,
        matchCount: result.matches.length,
        bytesWritten: 0,
        skipped: true,
        skipReason: `backup-failed: ${(err as Error).message}`,
      };
    }
  }

  const tmpPath = join(dirname(path), `.keynv.tmp.${ts}.${process.pid}`);
  try {
    const fh = await open(tmpPath, 'w', 0o600);
    try {
      await fh.writeFile(redactedText, 'utf8');
      await fh.sync();
    } finally {
      await fh.close();
    }
    await rename(tmpPath, path);
  } catch (err) {
    // Clean up the temp file on failure; leave backup in place so the
    // user can recover.
    try {
      await unlink(tmpPath);
    } catch {
      // ignore
    }
    return {
      path,
      matchCount: result.matches.length,
      bytesWritten: 0,
      skipped: true,
      skipReason: `write-failed: ${(err as Error).message}`,
    };
  }

  const written = Buffer.byteLength(redactedText, 'utf8');
  return {
    path,
    matchCount: result.matches.length,
    bytesWritten: written,
    ...(backupPath !== undefined ? { backupPath } : {}),
  };
}

function isoCompact(d: Date): string {
  // Filesystem-safe stamp: 20260518T194913Z
  return `${d.toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z')}`;
}

/**
 * Copies `src` to the first non-existing backup path — `base`, then `base-2`,
 * `base-3`, … — using COPYFILE_EXCL so the create-or-skip is atomic and a
 * same-second second scrub can never clobber an earlier backup.
 */
async function backupWithoutClobber(src: string, base: string): Promise<string> {
  for (let i = 0; ; i++) {
    const dest = i === 0 ? base : `${base}-${i + 1}`;
    try {
      await copyFile(src, dest, constants.COPYFILE_EXCL);
      return dest;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw err;
    }
  }
}

/** Convenience for surfaces that have a single file path. */
export async function rewriteSingleFile(
  path: string,
  options: RewriteOptions,
  meta: RewriteFileMeta = {},
): Promise<RewriteFileResult> {
  return rewriteFile(path, options, meta);
}
