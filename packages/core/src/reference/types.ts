/**
 * The decomposed parts of a keynv alias literal `@project.environment.key`.
 *
 * `literal` holds the original string including the leading `@`; `project`,
 * `environment`, and `key` are the validated components.
 */
export interface Alias {
  readonly literal: string;
  readonly project: string;
  readonly environment: string;
  readonly key: string;
}

/**
 * An alias detected inside a larger string, with its byte offsets.
 *
 * `start` is inclusive, `end` is exclusive. `text.slice(start, end)` equals
 * `literal`.
 */
export interface AliasMatch extends Alias {
  readonly start: number;
  readonly end: number;
}

/**
 * Selects how aggressive the finder is.
 *
 * - `'text'` (default): conservative. Aliases preceded by a word character,
 *   `.`, `@`, or `/` are rejected, so e.g. `support@billing.example.com`
 *   does not produce a false positive.
 * - `'argv'`: permissive. Used when scanning shell argv where flag prefixes
 *   like `-p@alias` are common; emails are unlikely.
 */
export type FindMode = 'text' | 'argv';

/**
 * Lexical limits for each component, copied from `docs/03-reference-syntax.md`.
 * Exposed here so callers (e.g. validation in the server API) can reuse them.
 */
export const ALIAS_LIMITS = {
  project: { min: 1, max: 48 },
  environment: { min: 1, max: 24 },
  key: { min: 1, max: 64 },
} as const;
