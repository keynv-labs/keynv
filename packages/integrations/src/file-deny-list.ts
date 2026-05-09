/**
 * The default deny list every integration uses. Patterns are
 * gitignore-style — most integrations consume them as-is; Claude
 * Code converts them into Read-tool permission denies.
 */
export const KEYNV_FILE_DENY_PATTERNS: ReadonlyArray<string> = [
  '.env',
  '.env.*',
  '*.env',
  '**/.env',
  '**/.env.*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  'id_rsa',
  'id_rsa.*',
  'id_ed25519',
  'id_ed25519.*',
  'id_ecdsa',
  'id_ecdsa.*',
  '*credentials*',
  '*.kdbx',
  '.aws/credentials',
  '.gcp/**/key.json',
  '**/google-services.json',
  '.azure/**',
];
