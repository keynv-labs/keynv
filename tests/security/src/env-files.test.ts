import { redact } from '@keynv/redactor';
import { describe, expect, it } from 'vitest';

/**
 * Threat model: docs/02-threat-model.md §"Agent reads .env directly".
 *
 * `keynv init` migrates .env files to the vault and writes .keynv.env
 * (alias refs only). The agent never sees raw values. This test suite
 * verifies the security invariants at the redactor boundary:
 *
 *  1. Secret-shaped values in .env KEY=VALUE syntax are redacted.
 *  2. Alias references (@project.env.key) are NOT redacted — they are
 *     safe to expose to the agent.
 *  3. Common literal config vars (NODE_ENV, PORT) are not false-positive
 *     redacted.
 *  4. Multi-line .env file output is redacted line-by-line.
 *
 * The end-to-end `keynv init` flow (server round-trip, file I/O) is
 * covered by the CLI's own unit tests in apps/cli.
 */

const X = (n: number) => 'X'.repeat(n);

const SECRETS_IN_ENV_SYNTAX = {
  dbUrl: `DATABASE_URL=postgres://user:${'p'}assword@db.example.com:5432/myapp`,
  awsKeyId: `AWS_ACCESS_KEY_ID=AKIA${'EXAMPLE'.repeat(2)}EX`,
  ghPat: `GITHUB_TOKEN=${'ghp'}_${X(36)}`,
  stripe: `STRIPE_SECRET=${'sk'}_${'live'}_${X(26)}`,
  openai: `OPENAI_API_KEY=${'sk'}-${'proj'}-${X(36)}`,
  jwt: `JWT_SECRET=${'eyJ'}${X(20)}.${'eyJ'}${X(20)}.${X(20)}`,
};

const ALIAS_REFS = {
  simple: 'DB_PASS=@myproject.dev.db-pass',
  qualified: 'OPENAI_API_KEY=@arkey.prod.openai-key',
  multiEnv: 'API_SECRET=@billing.staging.api-secret',
};

const LITERAL_CONFIG = {
  nodeEnv: 'NODE_ENV=development',
  port: 'PORT=3000',
  debug: 'DEBUG=express:*',
  publicUrl: 'NEXT_PUBLIC_API_URL=https://api.example.com',
  tz: 'TZ=America/Chicago',
};

describe('env-files: secret-shaped values in .env syntax are redacted', () => {
  it.each([
    ['DATABASE_URL with postgres credentials', SECRETS_IN_ENV_SYNTAX.dbUrl],
    ['AWS_ACCESS_KEY_ID', SECRETS_IN_ENV_SYNTAX.awsKeyId],
    ['GITHUB_TOKEN (classic PAT)', SECRETS_IN_ENV_SYNTAX.ghPat],
    ['STRIPE_SECRET (live key)', SECRETS_IN_ENV_SYNTAX.stripe],
    ['OPENAI_API_KEY (project key)', SECRETS_IN_ENV_SYNTAX.openai],
    ['JWT_SECRET', SECRETS_IN_ENV_SYNTAX.jwt],
  ])('redacts %s', (_label, fixture) => {
    const result = redact(fixture);
    expect(result.text).toContain('=');
    const valuePart = fixture.split('=')[1] as string;
    expect(result.text).not.toContain(valuePart);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts only the value, preserving the KEY= prefix', () => {
    const result = redact(SECRETS_IN_ENV_SYNTAX.dbUrl);
    expect(result.text).toContain('DATABASE_URL=');
    expect(result.text).not.toContain('password');
    expect(result.text).not.toContain('postgres://');
  });

  it('redacts an env-file block with multiple secrets on separate lines', () => {
    const block = [
      SECRETS_IN_ENV_SYNTAX.dbUrl,
      SECRETS_IN_ENV_SYNTAX.awsKeyId,
      SECRETS_IN_ENV_SYNTAX.ghPat,
    ].join('\n');
    const result = redact(block);
    for (const line of result.text.split('\n')) {
      expect(line).not.toMatch(/password/i);
      expect(line).not.toMatch(/\bAKIA/);
      expect(line).not.toMatch(/\bghp_/);
    }
    // Metadata should still preserve key names
    expect(result.text).toContain('DATABASE_URL');
    expect(result.text).toContain('AWS_ACCESS_KEY_ID');
    expect(result.text).toContain('GITHUB_TOKEN');
  });
});

describe('env-files: alias references pass through unredacted', () => {
  it.each([
    ['simple alias', ALIAS_REFS.simple],
    ['qualified alias', ALIAS_REFS.qualified],
    ['multi-env alias', ALIAS_REFS.multiEnv],
  ])('passes through %s unchanged', (_label, fixture) => {
    const result = redact(fixture);
    expect(result.text).toBe(fixture);
    expect(result.matches).toHaveLength(0);
  });

  it('does not redact a .keynv.env file consisting entirely of alias references', () => {
    const content = [
      '# .keynv.env — alias references to vault secrets.',
      '# Safe to commit.',
      'OPENAI_API_KEY=@arkey.dev.openai-key',
      'DB_PASS=@arkey.dev.db-pass',
      'STRIPE_SECRET=@arkey.dev.stripe-key',
    ].join('\n');
    const result = redact(content);
    expect(result.text).toBe(content);
    expect(result.matches).toHaveLength(0);
  });

  it('redacts raw values mixed with alias refs (mixed file)', () => {
    const content = [
      'OPENAI_API_KEY=@arkey.dev.openai-key',
      `LEGACY_KEY=sk-${'proj'}-${X(36)}`,
      'DB_PASS=@arkey.dev.db-pass',
    ].join('\n');
    const result = redact(content);
    expect(result.text).toContain('OPENAI_API_KEY=@arkey.dev.openai-key');
    expect(result.text).toContain('LEGACY_KEY=');
    expect(result.text).toContain('DB_PASS=@arkey.dev.db-pass');
    expect(result.text).not.toContain('sk-proj-');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('env-files: literal config vars are not false-positive redacted', () => {
  it.each([
    ['NODE_ENV', LITERAL_CONFIG.nodeEnv],
    ['PORT', LITERAL_CONFIG.port],
    ['DEBUG', LITERAL_CONFIG.debug],
    ['NEXT_PUBLIC_API_URL', LITERAL_CONFIG.publicUrl],
    ['TZ', LITERAL_CONFIG.tz],
  ])('passes through %s unchanged', (_label, fixture) => {
    const result = redact(fixture);
    expect(result.text).toBe(fixture);
    expect(result.matches).toHaveLength(0);
  });

  it('passes through an .env file consisting only of literal config', () => {
    const content = [
      'NODE_ENV=development',
      'PORT=3000',
      'DEBUG=app:*',
      'NEXT_PUBLIC_API_URL=https://api.example.com',
      'LOG_LEVEL=debug',
    ].join('\n');
    const result = redact(content);
    expect(result.text).toBe(content);
    expect(result.matches).toHaveLength(0);
  });
});

describe('env-files: quoted values and whitespace edge cases', () => {
  it('redacts a double-quoted secret value', () => {
    const line = `SECRET="${'sk'}_${'live'}_${X(26)}"`;
    const result = redact(line);
    expect(result.text).toContain('SECRET="');
    expect(result.text).toContain('"');
    expect(result.text).not.toContain('sk_live_');
  });

  it('redacts a secret with an export prefix', () => {
    const line = `export DATABASE_URL=postgres://user:${'p'}ass@db.example.com/myapp`;
    const result = redact(line);
    expect(result.text).toContain('export DATABASE_URL=');
    expect(result.text).not.toContain('pass');
  });

  it('handles trailing whitespace on secret values', () => {
    const line = `TOKEN=${'ghp'}_${X(36)}   `;
    const result = redact(line);
    expect(result.text).not.toContain('ghp_');
    expect(result.text).toMatch(/\s+$/);
  });
});

describe('env-files: lines adjacent to KEY=VALUE secrets', () => {
  it('redacts a secret on a line with an adjacent comment', () => {
    const block = [
      '# Production secrets',
      `DATABASE_URL=postgres://user:${'p'}assword@db.example.com:5432/myapp`,
      '# End of secrets',
    ].join('\n');
    const result = redact(block);
    expect(result.text).toContain('# Production secrets');
    expect(result.text).toContain('# End of secrets');
    expect(result.text).not.toContain('password');
  });

  it('redacts postgres URLs even inside comments (conservative — over-redact is safer than under-redact)', () => {
    const block = `# Example: DATABASE_URL=postgres://user:${'p'}ass@localhost/db`;
    const result = redact(block);
    expect(result.text).toContain('# Example: DATABASE_URL=');
    expect(result.text).toContain('<REDACTED:postgres-uri>');
    expect(result.text).not.toContain('pass@localhost');
  });
});
