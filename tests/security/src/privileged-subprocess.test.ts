import { redact } from '@keynv/redactor';
import { describe, expect, it } from 'vitest';

/**
 * Threat model: docs/02-threat-model.md §"Tool output reaches LLM provider logs"
 * and §"Compromised dependency in agent process scans env / file system".
 *
 * The privileged subprocess approach: AI agents only ever see the literal
 * `@project.env.key` in tool inputs/outputs; resolved values land only in
 * the subprocess argv/env/stdin and are never sent back through the agent.
 *
 * This suite verifies the redactor invariants that keep secret values out
 * of tool output visible to the agent:
 *
 *  1. Secret-shaped values in command output are redacted.
 *  2. Alias references in output pass through unredacted.
 *  3. The redactor preserves non-secret parts of command output.
 *  4. Literal-match redaction covers resolved values the caller provides.
 *  5. Disabling redaction (--no-redact equivalent) skips the redactor.
 *  6. Subprocess output containing multiple secrets gets each one redacted.
 *
 * End-to-end `keynv exec -- <cmd>` behaviour is covered by the CLI
 * integration tests; this suite tests the redactor boundary.
 */

const X = (n: number) => 'X'.repeat(n);

describe('privileged-subprocess: alias references in output preserved', () => {
  it('does not redact alias-shaped strings in tool output', () => {
    const output = [
      'keynv: loaded 3 vars from /app/.keynv.env (3 resolved from vault)',
      'Running: psql -p @billing.dev.db-pass -h db.example.com',
      'Connected to database.',
    ].join('\n');
    const result = redact(output);
    expect(result.text).toContain('@billing.dev.db-pass');
    expect(result.matches).toHaveLength(0);
  });

  it('does not redact alias references in composite output', () => {
    const output =
      'Executing: curl -H "Authorization: @project.prod.api-key" https://api.example.com';
    const result = redact(output);
    expect(result.text).toBe(output);
    expect(result.matches).toHaveLength(0);
  });
});

describe('privileged-subprocess: secret values in subprocess stdout are redacted', () => {
  it('redacts a postgres URI in subprocess output', () => {
    const stderr = `ERROR: connection failed postgres://user:${'p'}assword@db.example.com:5432/app (timeout)`;
    const result = redact(stderr);
    expect(result.text).not.toContain('password');
    expect(result.text).toContain('ERROR');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts an AWS key printed by a subprocess', () => {
    const stdout = `Loaded credentials: AKIA${'EXAMPLE'.repeat(2)}EX from config`;
    const result = redact(stdout);
    expect(result.text).not.toMatch(/\bAKIA/);
    expect(result.text).toContain('Loaded credentials:');
    expect(result.matches.length).toBe(1);
  });

  it('redacts a JWT printed to stdout', () => {
    const jwt = `${'eyJ'}hbGciOiJSUzI1NiJ9.${'eyJ'}zdWIiOiIxMjM0In0.${'signa'}ture-data-here`;
    const stdout = `Authorization: Bearer ${jwt}`;
    const result = redact(stdout);
    expect(result.text).toContain('Authorization: Bearer');
    expect(result.text).not.toContain('hbGciOi');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts a GitHub PAT used as a subprocess argument', () => {
    const output = `Downloading from repo using token ${'ghp'}_${X(36)}`;
    const result = redact(output);
    expect(result.text).not.toMatch(/\bghp_/);
    expect(result.matches.length).toBe(1);
  });
});

describe('privileged-subprocess: multiple secrets on same output line', () => {
  it('redacts two different secrets on one line', () => {
    const key1 = `AKIA${'EXAMPLE'.repeat(2)}EX`;
    const key2 = `${'ghp'}_${X(36)}`;
    const line = `export AWS=${key1} GITHUB=${key2}`;
    const result = redact(line);
    expect(result.text).not.toMatch(/\bAKIA/);
    expect(result.text).not.toMatch(/\bghp_/);
    expect(result.matches.length).toBe(2);
  });

  it('redacts secrets spanning multiple lines in subprocess stderr', () => {
    const block = [
      'ERROR: could not connect to database',
      `  Connection string: postgres://user:${'p'}assword@db.example.com:5432/app`,
      `  Fallback: postgres://user:${'pass'}word2@fallback.example.com:5432/app`,
      '  Retry in 5s...',
    ].join('\n');
    const result = redact(block);
    expect(result.text).not.toContain('password');
    expect(result.text).not.toContain('pass');
    expect(result.text).toContain('ERROR: could not connect');
    expect(result.text).toContain('Retry in 5s...');
    expect(result.matches.length).toBe(2);
  });
});

describe('privileged-subprocess: literal-match redaction for resolved values', () => {
  it('redacts a known resolved value passed as a literal', () => {
    const resolvedValue = 'aVerySecretPassword123!@#';
    const stdout = `The password is ${resolvedValue} and should not appear`;
    const result = redact(stdout, { literals: [resolvedValue] });
    expect(result.text).not.toContain(resolvedValue);
    expect(result.text).toContain('<REDACTED:');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts multiple resolved values from the same output', () => {
    const apiKey = 'custom-api-key-xyz-12345';
    const dbPass = 'custom-db-password-67890';
    const output = `API=${apiKey} DB=${dbPass}`;
    const result = redact(output, { literals: [apiKey, dbPass] });
    expect(result.text).not.toContain(apiKey);
    expect(result.text).not.toContain(dbPass);
    expect(result.matches.length).toBe(2);
  });
});

describe('privileged-subprocess: --no-redact skips redaction', () => {
  it('does not redact when redactor is disabled (--no-redact equivalent)', () => {
    const secret = `AKIA${'EXAMPLE'.repeat(2)}EX`;
    const line = `key_id=${secret}`;
    const result = redact(line, {
      patterns: [],
      entropy: { enabled: false },
    });
    expect(result.text).toBe(line);
    expect(result.matches).toHaveLength(0);
  });

  it('suppresses entropy detector when explicitly disabled', () => {
    const hiToken = 'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3w'; // ~5.5 bits/char
    const result = redact(`TOKEN=${hiToken}`, {
      entropy: { enabled: false },
    });
    expect(result.text).toContain(hiToken);
    expect(result.matches).toHaveLength(0);
  });
});

describe('privileged-subprocess: redactor preserves non-secret output', () => {
  it('preserves command structure, paths, and hostnames', () => {
    const output = [
      '[info] Starting database migration...',
      '  Applying: 20240101_add_users_table.sql',
      '  Target:   /var/lib/postgresql/data',
      '  Host:     db-primary.internal.example.com',
      '  Done.',
    ].join('\n');
    const result = redact(output);
    expect(result.text).toBe(output);
    expect(result.matches).toHaveLength(0);
  });

  it('preserves numeric output (metrics, timestamps, exit codes)', () => {
    const output = [
      'Process exited with code 0',
      'Duration: 1.234s',
      'Rows affected: 42',
      'Memory: 123.4 MB',
      'Timestamp: 2026-05-13T07:00:00.000Z',
    ].join('\n');
    const result = redact(output);
    for (const line of output.split('\n')) {
      if (line) expect(result.text).toContain(line);
    }
    expect(result.matches).toHaveLength(0);
  });
});
