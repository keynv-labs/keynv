import { findEntropyMatches } from './entropy.js';
import { BUILTIN_PATTERNS } from './patterns.js';
import type { Match, Pattern, RedactOptions, RedactResult } from './types.js';

const ENTROPY_PATTERN_NAME = 'high-entropy';
const LITERAL_PATTERN_NAME = 'literal-alias-resolved-value';

function defaultRender(name: string): string {
  return `<REDACTED:${name}>`;
}

function preview(matched: string): string {
  return matched.length <= 8 ? matched : `${matched.slice(0, 4)}...`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walks `patterns` and `text`, returning every non-overlapping hit.
 *
 * When two patterns overlap, the earlier-starting (longer when tied)
 * match wins. This avoids double-redaction artifacts like
 * `<REDACTED:postgres-uri>` further nibbled by `<REDACTED:high-entropy>`.
 */
export function redact(text: string, opts: RedactOptions = {}): RedactResult {
  if (typeof text !== 'string' || text.length === 0) {
    return { text, matches: [] };
  }

  const patterns: Pattern[] = [
    ...(opts.patterns ?? BUILTIN_PATTERNS),
    ...(opts.extraPatterns ?? []),
  ];

  // Pattern matches.
  const raw: Match[] = [];
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    for (const m of text.matchAll(pattern.regex)) {
      if (m.index === undefined) continue;
      raw.push({
        pattern: pattern.name,
        start: m.index,
        end: m.index + m[0].length,
        preview: preview(m[0]),
      });
    }
  }

  // Literal matches (e.g., resolved alias values that the caller wants
  // pre-emptively redacted).
  if (opts.literals && opts.literals.length > 0) {
    for (const literal of opts.literals) {
      if (!literal) continue;
      const re = new RegExp(escapeRegExp(literal), 'g');
      for (const m of text.matchAll(re)) {
        if (m.index === undefined) continue;
        raw.push({
          pattern: LITERAL_PATTERN_NAME,
          start: m.index,
          end: m.index + literal.length,
          preview: preview(literal),
        });
      }
    }
  }

  // Entropy detector.
  const entropyMatches = findEntropyMatches(text, opts.entropy);
  for (const m of entropyMatches) {
    raw.push({
      pattern: ENTROPY_PATTERN_NAME,
      start: m.start,
      end: m.end,
      preview: preview(m.token),
    });
  }

  if (raw.length === 0) return { text, matches: [] };

  // Sort and de-overlap (earliest start wins; longer match wins on tie).
  raw.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const merged: Match[] = [];
  for (const m of raw) {
    const last = merged[merged.length - 1];
    if (!last || m.start >= last.end) merged.push(m);
  }

  // Build redacted output right-to-left so offsets remain valid.
  let out = text;
  for (let i = merged.length - 1; i >= 0; i--) {
    const m = merged[i];
    if (!m) continue;
    const original = text.slice(m.start, m.end);
    const renderer =
      patterns.find((p) => p.name === m.pattern)?.redactWith ?? (() => defaultRender(m.pattern));
    out = out.slice(0, m.start) + renderer(original) + out.slice(m.end);
  }
  return { text: out, matches: merged };
}
