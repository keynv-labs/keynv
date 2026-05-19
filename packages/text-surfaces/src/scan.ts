import { readFile, stat } from 'node:fs/promises';
import { type RedactOptions, redact } from '@keynv/redactor';
import type { ScanOptions, TextSurfaceFileScan, TextSurfaceMatchPreview } from './types.js';

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_PREVIEWS = 5;

/**
 * Entropy-detector exclude prefixes used by `keynv doctor` scans.
 *
 * The redactor's default prefix bank covers content-hash markers
 * (sha1-, sha256:, etc.). When scanning text *surfaces* — shell
 * histories, transcripts, logs — we also need to suppress long
 * filesystem paths, which are otherwise high-entropy enough to trip
 * the detector. A 38-char `/Users/foo/bar/.../baz.txt` is not a secret.
 *
 * Note: this *does* cost us detection of base64 values that begin
 * with `/` (uncommon — base64 starts with `/` only ~1/64 of the time
 * and most real secrets we care about are vendor-prefixed, JWT, or
 * PEM-wrapped). Acceptable tradeoff for the order-of-magnitude
 * false-positive reduction in `doctor` runs.
 */
const SURFACE_ENTROPY_EXCLUDE_PREFIXES: ReadonlyArray<string> = [
  // hash markers (mirrors redactor entropy default)
  'sha1-',
  'sha256:',
  'sha256-',
  'sha384-',
  'sha512-',
  // filesystem path heads
  '/',
  './',
  '../',
  '~/',
  // common URL schemes (URLs aren't secrets per se; if they're
  // credential-bearing the URI-pattern bank handles them)
  'http://',
  'https://',
  'file://',
];

/**
 * Scans a single file and returns counts + previews. Never returns the
 * raw file contents or the raw matched substrings — the caller cannot
 * accidentally print a secret by holding a `TextSurfaceFileScan`.
 *
 * `transform` lets per-surface scanners normalise content before
 * regexing (e.g., fish_history's encoded backslash escapes). Default
 * is identity.
 */
export async function scanFile(
  path: string,
  options: ScanOptions = {},
  transform: (raw: string) => string = (s) => s,
): Promise<TextSurfaceFileScan> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxPreviews = options.maxPreviewsPerFile ?? DEFAULT_MAX_PREVIEWS;

  let bytes = 0;
  try {
    const st = await stat(path);
    bytes = st.size;
  } catch (err) {
    return {
      path,
      bytes: 0,
      matchCount: 0,
      previews: [],
      patternCounts: {},
      skipped: true,
      skipReason: (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'stat-failed',
    };
  }

  if (bytes > maxBytes) {
    return {
      path,
      bytes,
      matchCount: 0,
      previews: [],
      patternCounts: {},
      skipped: true,
      skipReason: `over ${Math.round(maxBytes / 1024 / 1024)}MB cap`,
    };
  }

  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    return {
      path,
      bytes,
      matchCount: 0,
      previews: [],
      patternCounts: {},
      skipped: true,
      skipReason: `read-failed: ${(err as Error).message}`,
    };
  }

  const text = transform(raw);
  const redactOpts: RedactOptions = {
    entropy:
      options.entropy === false
        ? { enabled: false }
        : { excludePrefixes: SURFACE_ENTROPY_EXCLUDE_PREFIXES },
  };
  if (options.literals && options.literals.length > 0) {
    redactOpts.literals = options.literals;
  }

  const result = redact(text, redactOpts);
  const matchCount = result.matches.length;
  const previews: TextSurfaceMatchPreview[] = result.matches
    .slice(0, maxPreviews)
    .map((m) => ({ pattern: m.pattern, preview: m.preview }));

  const patternCounts: Record<string, number> = {};
  for (const m of result.matches) {
    patternCounts[m.pattern] = (patternCounts[m.pattern] ?? 0) + 1;
  }

  return {
    path,
    bytes,
    matchCount,
    previews,
    patternCounts,
  };
}

export const SCAN_DEFAULTS = {
  maxBytes: DEFAULT_MAX_BYTES,
  maxPreviewsPerFile: DEFAULT_MAX_PREVIEWS,
  maxFilesPerSurface: 5000,
} as const;
