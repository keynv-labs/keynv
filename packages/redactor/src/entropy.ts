import type { EntropyOptions } from './types.js';

/** Token boundary characters. We split on whitespace, quotes, and common
 * separators that appear around credential-shaped substrings. */
const TOKEN_BOUNDARY_RE = /[\s,;:'"<>(){}[\]=]+/;

const DEFAULT_EXCLUDE_PREFIXES: ReadonlyArray<string> = [
  'sha1-',
  'sha256:',
  'sha256-',
  'sha384-',
  'sha512-',
];

const DEFAULTS: Required<EntropyOptions> = {
  enabled: true,
  minLength: 24,
  minBitsPerChar: 4.5,
  excludePrefixes: DEFAULT_EXCLUDE_PREFIXES,
};

/**
 * Shannon entropy of a string in bits-per-character. Higher = more
 * "random-looking". Real secrets typically score 4.0-6.0 bits/char.
 */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const n = s.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

export interface EntropyMatch {
  start: number;
  end: number;
  token: string;
}

/**
 * Finds high-entropy tokens within `text`. Tokens are split on
 * whitespace + common separators; each candidate token is checked
 * against the length and entropy thresholds.
 */
export function findEntropyMatches(text: string, opts: EntropyOptions = {}): EntropyMatch[] {
  const cfg = { ...DEFAULTS, ...opts };
  if (!cfg.enabled) return [];

  const matches: EntropyMatch[] = [];
  let i = 0;
  while (i < text.length) {
    // Skip token boundaries.
    while (i < text.length && TOKEN_BOUNDARY_RE.test(text[i] ?? '')) i++;
    if (i >= text.length) break;

    const start = i;
    while (i < text.length && !TOKEN_BOUNDARY_RE.test(text[i] ?? '')) i++;
    const end = i;
    const token = text.slice(start, end);

    if (token.length >= cfg.minLength) {
      const lower = token.toLowerCase();
      const excluded = cfg.excludePrefixes.some((p) => lower.startsWith(p));
      if (!excluded) {
        const h = shannonEntropy(token);
        if (h >= cfg.minBitsPerChar) {
          matches.push({ start, end, token });
        }
      }
    }
  }
  return matches;
}
