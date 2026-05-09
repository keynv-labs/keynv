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
