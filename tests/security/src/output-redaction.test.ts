import { describe, it } from 'vitest';

// Threat model: docs/02-threat-model.md §pattern-bank.
// Property-style assertions over the redactor's pattern bank. These test
// that documented patterns are caught and that non-secret innocuous data
// is preserved.

describe('output-redaction: built-in pattern bank', () => {
  it.todo('postgres URI (postgres://user:pass@host/db) is redacted');
  it.todo('mysql URI is redacted');
  it.todo('mongodb URI (incl. +srv) is redacted');
  it.todo('AWS access key id (AKIA...) is redacted');
  it.todo('GitHub PAT (ghp_...) is redacted');
  it.todo('GitHub fine-grained PAT (github_pat_...) is redacted');
  it.todo('Slack bot/user tokens (xoxb-, xoxp-) are redacted');
  it.todo('Stripe live secret key (sk_live_...) is redacted');
  it.todo('OpenAI API key (sk-... and sk-proj-...) is redacted');
  it.todo('Anthropic API key (sk-ant-...) is redacted');
  it.todo('Google API key (AIza...) is redacted');
  it.todo('JWT-shaped token (eyJ...eyJ...) is redacted');
  it.todo('RSA / OpenSSH private key blocks (multi-line) are redacted');
  it.todo('PGP private key blocks (multi-line) are redacted');
  it.todo('high-entropy string adjacent to context hint ("password", "secret") is redacted');
  it.todo('UUID v4 is NOT redacted as a generic high-entropy false positive');
  it.todo('git short SHA (7-char hex) is NOT redacted');
  it.todo('git long SHA (40-char hex) is NOT redacted unless context-hinted');
  it.todo('innocent base64 of public data (length ≥ 24) is NOT redacted by default');
  it.todo('redactor pattern bank coverage: ≥ 99% true-positive on fixtures/secret-like.txt');
  it.todo('redactor pattern bank coverage: ≤ 1% false-positive on fixtures/innocent.txt');
});
