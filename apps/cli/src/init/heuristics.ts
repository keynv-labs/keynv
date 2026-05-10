/**
 * Decide whether a `KEY=value` pair from a `.env` file is more likely
 * a secret (should be uploaded to the vault) or a literal config
 * value (should remain in `.keynv.env` as-is).
 *
 * Used to pre-check items in the `keynv init` checklist; the user
 * always has the final say. The verdict comes with a short hint
 * string the UI can show next to the entry.
 */

export type SecretVerdict = 'secret' | 'literal' | 'ambiguous';

export interface ClassifyResult {
  verdict: SecretVerdict;
  hint: string;
}

/**
 * Names that are almost always non-secret config. Exact-match or
 * prefix match (the trailing `*` marks a prefix). Order doesn't
 * matter — first list with a hit wins.
 */
const NAME_LITERAL_EXACT = new Set([
  'NODE_ENV',
  'PORT',
  'HOST',
  'HOSTNAME',
  'DEBUG',
  'LOG_LEVEL',
  'LOGLEVEL',
  'TZ',
  'LANG',
  'LC_ALL',
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'PWD',
  'CI',
  'NODE_OPTIONS',
  'NPM_CONFIG_LOGLEVEL',
  'TS_NODE_PROJECT',
]);
const NAME_LITERAL_PREFIX = ['NEXT_PUBLIC_', 'VITE_', 'REACT_APP_', 'PUBLIC_', 'EXPO_PUBLIC_'];

/**
 * Substrings that strongly suggest the value is a secret. Matched
 * case-insensitively against the key name. Reading order matters:
 * the most specific suffix first so the hint is precise.
 */
const NAME_SECRET_SUFFIXES: Array<{ suffix: string; hint: string }> = [
  { suffix: 'PRIVATE_KEY', hint: 'private key' },
  { suffix: 'API_KEY', hint: 'API key' },
  { suffix: 'ACCESS_KEY', hint: 'access key' },
  { suffix: 'SECRET_KEY', hint: 'secret key' },
  { suffix: 'SECRET', hint: 'secret' },
  { suffix: 'PASSWORD', hint: 'password' },
  { suffix: 'PASSPHRASE', hint: 'passphrase' },
  { suffix: 'TOKEN', hint: 'token' },
  { suffix: 'KEY', hint: 'key' },
  { suffix: 'CREDENTIALS', hint: 'credentials' },
  { suffix: 'AUTH', hint: 'auth' },
  { suffix: 'DSN', hint: 'connection string' },
];
const NAME_DB_URL = /^(DATABASE|DB|POSTGRES|MYSQL|MONGO|REDIS)_URL$/i;

/**
 * Value-shaped secret detectors. Hit means the value pattern alone
 * is enough to flag — even with a generic-looking name. Listed in
 * specificity order so the hint is informative.
 */
const VALUE_PATTERNS: Array<{ re: RegExp; hint: string }> = [
  { re: /^sk-proj-/, hint: 'OpenAI project key' },
  { re: /^sk-[A-Za-z0-9]{20,}/, hint: 'OpenAI key' },
  { re: /^sk_live_/, hint: 'Stripe live key' },
  { re: /^sk_test_/, hint: 'Stripe test key' },
  { re: /^pk_live_/, hint: 'Stripe publishable (often public, double-check)' },
  { re: /^xoxb-/, hint: 'Slack bot token' },
  { re: /^xoxp-/, hint: 'Slack user token' },
  { re: /^ghp_[A-Za-z0-9]{30,}/, hint: 'GitHub personal access token' },
  { re: /^github_pat_/, hint: 'GitHub fine-grained PAT' },
  { re: /^gho_/, hint: 'GitHub OAuth token' },
  { re: /^AKIA[0-9A-Z]{16}$/, hint: 'AWS access key id' },
  { re: /^ASIA[0-9A-Z]{16}$/, hint: 'AWS temporary key id' },
  { re: /^AIza[0-9A-Za-z_-]{35}$/, hint: 'Google API key' },
  { re: /^ya29\./, hint: 'Google OAuth access token' },
  { re: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, hint: 'JWT' },
  { re: /^-----BEGIN [A-Z ]+PRIVATE KEY-----/, hint: 'PEM private key' },
  { re: /^([a-z]+):\/\/[^@]+:[^@]+@/i, hint: 'connection string with credentials' },
];

/** Shannon entropy in bits per character for a string. */
function shannonEntropyBits(s: string): number {
  if (s.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function nameMatchesLiteralPrefix(name: string): boolean {
  const upper = name.toUpperCase();
  return NAME_LITERAL_PREFIX.some((p) => upper.startsWith(p));
}

function nameMatchesSecretSuffix(name: string): { matched: boolean; hint: string } {
  const upper = name.toUpperCase();
  for (const { suffix, hint } of NAME_SECRET_SUFFIXES) {
    if (upper.endsWith(suffix) || upper.endsWith(`_${suffix}`)) {
      return { matched: true, hint };
    }
  }
  return { matched: false, hint: '' };
}

/**
 * Classify a single .env entry. The verdict drives the default
 * checked state in the init UI; the hint is shown next to the row.
 */
export function classifyEntry(name: string, value: string): ClassifyResult {
  const upper = name.toUpperCase();

  // 1. Hard literal allowlist — these are basically never secrets.
  if (NAME_LITERAL_EXACT.has(upper)) {
    return { verdict: 'literal', hint: 'common config var' };
  }
  if (nameMatchesLiteralPrefix(name)) {
    return { verdict: 'literal', hint: 'public env (build-time bundled)' };
  }

  // 2. Empty values can't be secrets in any meaningful sense.
  if (value.length === 0) {
    return { verdict: 'literal', hint: 'empty' };
  }

  // 3. Value-shape evidence — strongest signal, overrides name.
  for (const { re, hint } of VALUE_PATTERNS) {
    if (re.test(value)) return { verdict: 'secret', hint };
  }

  // 4. Name-shape evidence.
  const suffix = nameMatchesSecretSuffix(name);
  if (suffix.matched) {
    return { verdict: 'secret', hint: suffix.hint };
  }
  if (NAME_DB_URL.test(name)) {
    return { verdict: 'secret', hint: 'database URL' };
  }

  // 5. Length + entropy heuristic for "looks like a random opaque
  // string". Short or low-entropy values stay ambiguous so the user
  // can decide.
  if (value.length >= 32) {
    const bits = shannonEntropyBits(value);
    if (bits >= 3.5) {
      return { verdict: 'secret', hint: `${value.length}-char random-looking string` };
    }
  }

  // 6. Default: not enough evidence either way.
  return { verdict: 'ambiguous', hint: '' };
}

/**
 * Render a tiny preview of a value safe to display in a checklist.
 * Long values are truncated; common secret-looking prefixes are kept
 * intact so the user recognizes them.
 */
export function previewValue(value: string, max = 40): string {
  if (value.length === 0) return '(empty)';
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
