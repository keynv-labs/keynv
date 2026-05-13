import { redact } from '@keynv/redactor';
import { describe, expect, it } from 'vitest';

/**
 * Threat model: docs/02-threat-model.md §"Agent runs env / printenv".
 *
 * keynv exec spawns subprocesses with a curated env (allowlist), so the
 * shell the AI agent runs commands in does not contain secret values in
 * the first place. The redactor catches anything that still slips through.
 *
 * This suite verifies the redactor handles printenv-style output:
 *  - Secrets on KEY=VALUE lines are redacted.
 *  - Alias references pass through untouched.
 *  - Literal config vars are not false-positive redacted.
 *  - High-entropy strings with context hints (password/secret/token) are
 *    redacted; same-length strings without those hints are preserved.
 *
 * The ENV_ALLOWLIST in apps/cli/src/exec/spawn.ts is verified by the
 * CLI unit tests; it is not accessible from this package boundary.
 */

const X = (n: number) => 'X'.repeat(n);

describe('env-enumeration: printenv-style output is redacted', () => {
  it('redacts a postgres URL in printenv-like output', () => {
    const line = `DATABASE_URL=postgres://user:${'p'}assword@db.example.com:5432/app`;
    const result = redact(line);
    expect(result.text).toContain('DATABASE_URL=');
    expect(result.text).not.toContain('password');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts an AWS access key id in printenv-like output', () => {
    const line = `AWS_ACCESS_KEY_ID=AKIA${'EXAMPLE'.repeat(2)}EX`;
    const result = redact(line);
    expect(result.text).toContain('AWS_ACCESS_KEY_ID=');
    expect(result.text).not.toMatch(/\bAKIA/);
    expect(result.matches.length).toBe(1);
  });

  it('redacts a GitHub PAT in printenv-like output', () => {
    const line = `GITHUB_TOKEN=${'ghp'}_${X(36)}`;
    const result = redact(line);
    expect(result.text).toContain('GITHUB_TOKEN=');
    expect(result.text).not.toMatch(/\bghp_/);
    expect(result.matches.length).toBe(1);
  });

  it('redacts a Stripe live key in printenv-like output', () => {
    const line = `STRIPE_SECRET_KEY=${'sk'}_${'live'}_${X(26)}`;
    const result = redact(line);
    expect(result.text).toContain('STRIPE_SECRET_KEY=');
    expect(result.text).not.toContain('sk_live_');
    expect(result.matches.length).toBe(1);
  });

  it('redacts a JWT in printenv-like output', () => {
    const jwt = `${'eyJ'}${X(20)}.${'eyJ'}${X(20)}.${X(20)}`;
    const line = `JWT_SECRET=${jwt}`;
    const result = redact(line);
    expect(result.text).not.toContain(jwt);
    expect(result.matches.length).toBe(1);
  });
});

describe('env-enumeration: alias references pass through', () => {
  it('does not redact alias-based env entries', () => {
    const lines = [
      'OPENAI_API_KEY=@arkey.dev.openai-key',
      'DB_PASSWORD=@arkey.dev.db-pass',
      'STRIPE_SECRET=@arkey.prod.stripe-key',
    ].join('\n');
    const result = redact(lines);
    expect(result.text).toBe(lines);
    expect(result.matches).toHaveLength(0);
  });
});

describe('env-enumeration: literal config vars preserved', () => {
  it('does not redact non-secret env entries', () => {
    const lines = [
      'NODE_ENV=development',
      'PORT=3000',
      'DEBUG=app:*',
      'TZ=America/Los_Angeles',
      'TERM=xterm-256color',
      'SHELL=/bin/zsh',
      'HOME=/Users/dev',
    ].join('\n');
    const result = redact(lines);
    expect(result.text).toBe(lines);
    expect(result.matches).toHaveLength(0);
  });
});

// High-entropy token: mixed-case alphanumeric, 32+ chars, ~5.5 bits/char
const hiToken = 'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3w';

describe('env-enumeration: high-entropy tokens with context hints', () => {
  it('redacts a high-entropy token adjacent to "password"', () => {
    const line = `PASSWORD=${hiToken}`;
    const result = redact(line);
    expect(result.text).toContain('PASSWORD=');
    expect(result.text).not.toContain(hiToken);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts a high-entropy token adjacent to "secret"', () => {
    const line = `SECRET=${hiToken}`;
    const result = redact(line);
    expect(result.text).toContain('SECRET=');
    expect(result.text).not.toContain(hiToken);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts a high-entropy token adjacent to "token"', () => {
    const line = `API_TOKEN=${hiToken}`;
    const result = redact(line);
    expect(result.text).toContain('API_TOKEN=');
    expect(result.text).not.toContain(hiToken);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts a high-entropy token adjacent to "key"', () => {
    const line = `ENCRYPTION_KEY=${hiToken}`;
    const result = redact(line);
    expect(result.text).toContain('ENCRYPTION_KEY=');
    expect(result.text).not.toContain(hiToken);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('env-enumeration: non-secret high-entropy strings preserved', () => {
  it('does not redact a v4 UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = redact(`TRACE_ID=${uuid}`);
    expect(result.text).toContain(uuid);
    expect(result.matches).toHaveLength(0);
  });

  it('does not redact a 40-char git SHA', () => {
    const sha = 'd41d8cd98f00b204e9800998ecf8427e0a1b2c3d';
    const result = redact(`COMMIT_SHA=${sha}`);
    expect(result.text).toContain(sha);
    expect(result.matches).toHaveLength(0);
  });

  it('does not redact a hex-encoded hash digest', () => {
    const digest = 'a' + '1b2c3d4e5f6789012345678901234567890abc';
    const result = redact(`MD5=${digest}`);
    expect(result.text).toContain(digest);
    expect(result.matches).toHaveLength(0);
  });

  it('does not redact base64-encoded data without secret context', () => {
    const b64 = 'dGVzdF9kYXRhX2hlcmVfbm90X2Ffc2VjcmV0';
    const result = redact(`BLOB=${b64}`);
    expect(result.text).toContain(b64);
    // Base64 tokens longer than 24 chars with high entropy may trigger
    // entropy detection — that's acceptable conservative behavior.
  });
});

describe('env-enumeration: mixed output (secrets + literals)', () => {
  it('redacts only the secret lines in a full printenv dump', () => {
    const dump = [
      'HOME=/Users/dev',
      'SHELL=/bin/zsh',
      'PATH=/usr/local/bin:/usr/bin:/bin',
      `OPENAI_API_KEY=${'sk'}-${'proj'}-${X(36)}`,
      'NODE_ENV=development',
      `DATABASE_URL=postgres://user:${'p'}assword@db.example.com:5432/app`,
      'PORT=3000',
    ].join('\n');
    const result = redact(dump);
    expect(result.text).toContain('HOME=/Users/dev');
    expect(result.text).toContain('SHELL=/bin/zsh');
    expect(result.text).toContain('PATH=/usr/local/bin:/usr/bin:/bin');
    expect(result.text).toContain('NODE_ENV=development');
    expect(result.text).toContain('PORT=3000');
    expect(result.text).not.toContain('sk-proj-');
    expect(result.text).not.toContain('password');
    expect(result.matches.length).toBe(2);
  });
});
