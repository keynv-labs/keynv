import type { Alias, AliasMatch, FindMode } from './types.js';

const PROJECT_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const ENV_RE = /^[a-z0-9][a-z0-9-]{0,23}$/;
const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

// Trailing boundary: forbid an immediately-following word char (would extend
// the key) AND forbid a `.<alias-start>` (would imply a 4-part alias). A bare
// trailing `.` — sentence punctuation — is allowed.
const TRAILING_BOUNDARY = '(?!\\w|\\.[a-z0-9])';
const TEXT_FIND_SOURCE = `(?<![\\w.@/])@[a-z0-9][a-z0-9-]{0,47}\\.[a-z0-9][a-z0-9-]{0,23}\\.[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}${TRAILING_BOUNDARY}`;
const ARGV_FIND_SOURCE = `@[a-z0-9][a-z0-9-]{0,47}\\.[a-z0-9][a-z0-9-]{0,23}\\.[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}${TRAILING_BOUNDARY}`;

const TEXT_FIND_RE = new RegExp(TEXT_FIND_SOURCE, 'g');
const ARGV_FIND_RE = new RegExp(ARGV_FIND_SOURCE, 'g');

/**
 * Parses an exact alias literal. Returns `null` if `input` is not a
 * well-formed `@project.environment.key` reference.
 *
 * Strict: case-sensitive (lowercase only), exactly three components,
 * each within the documented length limits.
 */
export function parseAlias(input: string): Alias | null {
  if (typeof input !== 'string' || input.length < 6) return null;
  if (input.charCodeAt(0) !== 64) return null;

  const dot1 = input.indexOf('.', 1);
  if (dot1 < 2) return null;
  const dot2 = input.indexOf('.', dot1 + 1);
  if (dot2 < 0 || dot2 === dot1 + 1) return null;
  if (input.indexOf('.', dot2 + 1) !== -1) return null;

  const project = input.slice(1, dot1);
  const environment = input.slice(dot1 + 1, dot2);
  const key = input.slice(dot2 + 1);

  if (!PROJECT_RE.test(project)) return null;
  if (!ENV_RE.test(environment)) return null;
  if (!KEY_RE.test(key)) return null;

  return { literal: input, project, environment, key };
}

/**
 * Scans a string for embedded aliases.
 *
 * The default `text` mode is conservative and avoids common false positives
 * like email addresses. Use `argv` mode when scanning shell command arguments
 * where patterns such as `mysql -p@billing.prod.db_password` are expected.
 *
 * Returned matches are ordered by `start` ascending and never overlap.
 */
export function findAliases(text: string, opts: { mode?: FindMode } = {}): AliasMatch[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const re = opts.mode === 'argv' ? ARGV_FIND_RE : TEXT_FIND_RE;
  re.lastIndex = 0;

  const matches: AliasMatch[] = [];
  for (const m of text.matchAll(re)) {
    const literal = m[0];
    const start = m.index;
    if (start === undefined) continue;
    const parsed = parseAlias(literal);
    if (!parsed) continue;
    matches.push({
      ...parsed,
      start,
      end: start + literal.length,
    });
  }
  return matches;
}

/**
 * Walks an argv array and returns every alias found inside any element.
 *
 * Uses `argv` mode automatically. The returned offsets are relative to the
 * containing argv string.
 */
export function findAliasesInArgv(
  argv: readonly string[],
): Array<{ argvIndex: number; matches: AliasMatch[] }> {
  const result: Array<{ argvIndex: number; matches: AliasMatch[] }> = [];
  for (let i = 0; i < argv.length; i++) {
    const element = argv[i];
    if (typeof element !== 'string') continue;
    const matches = findAliases(element, { mode: 'argv' });
    if (matches.length > 0) {
      result.push({ argvIndex: i, matches });
    }
  }
  return result;
}

/**
 * Replaces every alias found in `text` with the value returned by `resolve`.
 *
 * Replacement is right-to-left so that already-computed offsets remain
 * valid. The resolver receives the parsed alias and returns the string that
 * should appear in its place. Throwing inside the resolver propagates.
 */
export function replaceAliases(
  text: string,
  resolve: (alias: Alias) => string,
  opts: { mode?: FindMode } = {},
): string {
  if (typeof text !== 'string' || text.length === 0) return text;
  const matches = findAliases(text, opts);
  if (matches.length === 0) return text;

  let out = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (!m) continue;
    const replacement = resolve(m);
    out = out.slice(0, m.start) + replacement + out.slice(m.end);
  }
  return out;
}

/**
 * Builds an alias literal from validated components without parsing.
 * Returns `null` if any component would fail validation.
 *
 * Useful for building aliases from server data (where components come from
 * separate columns) without re-running the full parser.
 */
export function buildAlias(parts: {
  project: string;
  environment: string;
  key: string;
}): Alias | null {
  if (!PROJECT_RE.test(parts.project)) return null;
  if (!ENV_RE.test(parts.environment)) return null;
  if (!KEY_RE.test(parts.key)) return null;
  return {
    literal: `@${parts.project}.${parts.environment}.${parts.key}`,
    project: parts.project,
    environment: parts.environment,
    key: parts.key,
  };
}
