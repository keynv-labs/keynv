// The default deny list every integration uses. Patterns are
// gitignore-style — most integrations consume them as-is; Claude
// Code converts them into Read-tool permission denies.
//
// Both project-relative (`.aws/credentials`) and globstar-prefixed
// (`**/.aws/credentials`) variants are listed so deny-engines that
// anchor patterns at the project root still catch the canonical
// `~/.aws/credentials` location when the agent's cwd is somewhere
// deeper. Tilde (`~`) is NOT in the list because most consumers'
// pattern syntaxes don't expand it; the globstar covers the same
// cases reliably (audit finding M6).
export const KEYNV_FILE_DENY_PATTERNS: ReadonlyArray<string> = [
  // dotenv variants
  '.env',
  '.env.*',
  '*.env',
  '**/.env',
  '**/.env.*',
  '**/*.env',

  // raw key material
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '**/*.pem',
  '**/*.key',
  '**/*.p12',
  '**/*.pfx',

  // SSH private keys
  'id_rsa',
  'id_rsa.*',
  'id_ed25519',
  'id_ed25519.*',
  'id_ecdsa',
  'id_ecdsa.*',
  '**/id_rsa',
  '**/id_rsa.*',
  '**/id_ed25519',
  '**/id_ed25519.*',
  '**/id_ecdsa',
  '**/id_ecdsa.*',

  // Generic credential containers
  '*credentials*',
  '*.kdbx',
  '**/*credentials*',
  '**/*.kdbx',

  // Cloud provider credential paths (typically under ~/, but also
  // appear at project roots in dev setups)
  '.aws/credentials',
  '**/.aws/credentials',
  '.aws/config',
  '**/.aws/config',
  '.gcp/**/key.json',
  '**/.gcp/**/key.json',
  '**/google-services.json',
  '**/service-account*.json',
  '.azure/**',
  '**/.azure/**',
  '.kube/config',
  '**/.kube/config',
  '.docker/config.json',
  '**/.docker/config.json',
];

/**
 * Patterns the agent IS allowed to read despite the broad `.env` deny
 * rules. `.keynv.env` is the alias-mapping file that ships with this
 * tool — it carries `@project.env.key` references, never resolved
 * values, so it is safe (and necessary) for the agent to read and
 * edit.
 *
 * Integrations apply these as either:
 *   - allow rules (Claude Code's permissions.allow), which take
 *     precedence over deny entries, OR
 *   - gitignore-style negations (`!.keynv.env`), placed AFTER the
 *     deny block so they re-include the file.
 */
export const KEYNV_FILE_ALLOW_PATTERNS: ReadonlyArray<string> = [
  '.keynv.env',
  '**/.keynv.env',
];

/**
 * Returns the lines a gitignore-style integration should write into a
 * keynv-managed block: every deny pattern, then every allow pattern as
 * a `!negation` so it re-includes the file. Order matters — gitignore
 * resolves rules top-down with later rules overriding earlier ones, so
 * negations MUST follow the deny block.
 */
export function gitignoreBlock(): string[] {
  return [...KEYNV_FILE_DENY_PATTERNS, ...KEYNV_FILE_ALLOW_PATTERNS.map((p) => `!${p}`)];
}
