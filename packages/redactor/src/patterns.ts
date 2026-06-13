import type { Pattern } from './types.js';

/**
 * Built-in pattern bank. Mirrored 1:1 with docs/02-threat-model.md
 * §pattern-bank. Adding a pattern:
 *  1. Append the entry here.
 *  2. Add a regression test in patterns.test.ts (positive + a negative
 *     to verify it doesn't false-positive on innocuous fixtures).
 *  3. Update docs/02-threat-model.md.
 */
export const BUILTIN_PATTERNS: ReadonlyArray<Pattern> = [
  // URI-shaped credentials
  {
    name: 'postgres-uri',
    regex: /postgres(?:ql)?:\/\/[^\s'"<>]+/g,
  },
  {
    name: 'mysql-uri',
    regex: /mysql:\/\/[^\s'"<>]+/g,
  },
  {
    name: 'mongodb-uri',
    regex: /mongodb(?:\+srv)?:\/\/[^\s'"<>]+/g,
  },
  {
    name: 'redis-uri-with-password',
    regex: /rediss?:\/\/[^@\s'"<>]+@[^\s'"<>]+/g,
  },
  {
    name: 'slack-webhook',
    regex: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+/g,
  },

  // Cloud provider keys
  {
    name: 'aws-access-key-id',
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: 'gcp-api-key',
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },

  // Vendor-prefixed tokens
  {
    name: 'github-pat-classic',
    regex: /\bghp_[A-Za-z0-9]{36}\b/g,
  },
  {
    name: 'github-oauth-user-to-server',
    regex: /\bghu_[A-Za-z0-9]{36}\b/g,
  },
  {
    name: 'github-oauth-server-to-server',
    regex: /\bgho_[A-Za-z0-9]{36}\b/g,
  },
  {
    // Fine-grained PATs are commonly 82 chars after the prefix but we
    // accept >=40 to cover dev-mode and future variations.
    name: 'github-pat-fine-grained',
    regex: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  },
  {
    name: 'slack-bot-token',
    regex: /\bxoxb-[A-Za-z0-9-]{24,}\b/g,
  },
  {
    name: 'slack-user-token',
    regex: /\bxoxp-[A-Za-z0-9-]{24,}\b/g,
  },
  {
    name: 'stripe-live-secret-key',
    regex: /\bsk_live_[A-Za-z0-9]{24,}\b/g,
  },
  {
    name: 'stripe-test-secret-key',
    regex: /\bsk_test_[A-Za-z0-9]{24,}\b/g,
  },
  {
    name: 'stripe-restricted-live-key',
    regex: /\brk_live_[A-Za-z0-9]{24,}\b/g,
  },
  {
    name: 'stripe-restricted-test-key',
    regex: /\brk_test_[A-Za-z0-9]{24,}\b/g,
  },
  {
    // Negative lookahead skips Anthropic-prefixed keys so the more
    // specific anthropic-api-key pattern wins on those.
    name: 'openai-api-key',
    regex: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: 'anthropic-api-key',
    regex: /\bsk-ant-(?:api03|admin01)-[A-Za-z0-9_-]{20,}\b/g,
  },

  // Hex-shaped vendor tokens. The entropy backstop structurally cannot
  // catch hex (max Shannon entropy log2(16)=4.0 < the 4.5 threshold), so
  // these are matched by their distinctive prefixes — high precision, near
  // zero false positives, unlike a blanket "long hex" rule which would fire
  // on git SHAs and content hashes.
  {
    name: 'twilio-account-sid',
    regex: /\bAC[0-9a-f]{32}\b/g,
  },
  {
    name: 'twilio-api-key-sid',
    regex: /\bSK[0-9a-f]{32}\b/g,
  },
  {
    name: 'mailgun-api-key',
    regex: /\bkey-[0-9a-f]{32}\b/g,
  },
  {
    name: 'sendgrid-api-key',
    regex: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g,
  },

  // Structured tokens
  {
    name: 'jwt',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },

  // PEM-armored private keys (multiline; not applied in streaming mode)
  {
    name: 'pem-private-key',
    regex: /-----BEGIN [A-Z][A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z][A-Z ]*PRIVATE KEY-----/g,
    multiline: true,
  },
  {
    name: 'pgp-private-key',
    regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]+?-----END PGP PRIVATE KEY BLOCK-----/g,
    multiline: true,
  },
];

/**
 * The subset of `BUILTIN_PATTERNS` that are safe to apply per-line in
 * a streaming context (no multiline regexes).
 */
export const BUILTIN_LINE_PATTERNS: ReadonlyArray<Pattern> = BUILTIN_PATTERNS.filter(
  (p) => !p.multiline,
);
