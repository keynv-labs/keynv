import { redact } from '@keynv/redactor';
import { describe, expect, it } from 'vitest';

/**
 * Threat model: docs/02-threat-model.md §"Compromised dependency in agent
 * process" + LLM03/Supply-chain.
 *
 * MCP `use_secret(alias)` must NEVER return a raw value — only single-use,
 * short-lived reference tokens. Resolution happens inside the privileged
 * subprocess that `keynv exec` forks.
 *
 * The token-level unit tests live in apps/mcp/src/tokens.test.ts. This
 * file verifies the invariants at the redactor boundary:
 *
 *  1. Reference-token-shaped strings are NOT false-positive redacted.
 *  2. Reference tokens embedded in JSON responses pass through safely.
 *  3. If a secret value leaked into an MCP response, the redactor catches it.
 *  4. Error messages containing secrets are sanitized.
 *  5. list_secrets-style responses (alias strings only) are safe.
 *  6. test_connection-style responses contain only metadata, no values.
 */

const X = (n: number) => 'X'.repeat(n);

describe('mcp-reference-token: tokens are not false-positive redacted', () => {
  it('does not redact a reference_token string', () => {
    const token = 'keynv-ref:abc123def4567890abcdef1234567890';
    const result = redact(token);
    expect(result.text).toBe(token);
    expect(result.matches).toHaveLength(0);
  });

  it('does not redact a reference token embedded in JSON', () => {
    const json = JSON.stringify({
      reference_token: 'keynv-ref:abcdef1234567890abcdef1234567890',
      alias: '@billing.dev.db-pass',
      expires_at: '2026-05-13T08:00:00.000Z',
      usage_hint:
        'Pass reference_token to a privileged subprocess (keynv exec --resolve). Token is single-use and expires in 60s.',
    });
    const result = redact(json);
    expect(result.text).toContain('keynv-ref:');
    expect(result.text).toContain('@billing.dev.db-pass');
    expect(result.matches).toHaveLength(0);
  });
});

describe('mcp-reference-token: list_secrets response is safe', () => {
  it('does not redact a list_secrets JSON response (only aliases, no values)', () => {
    const response = JSON.stringify({
      secrets: [
        { alias: '@billing.dev.api-key', env: 'dev' },
        { alias: '@billing.dev.db-pass', env: 'dev' },
        { alias: '@billing.staging.db-pass', env: 'staging' },
      ],
    });
    const result = redact(response);
    expect(result.text).toBe(response);
    expect(result.matches).toHaveLength(0);
  });

  it('does not redact alias strings in any context', () => {
    const aliases = ['@billing.dev.db-pass', '@arkey.prod.openai-key', '@myapp.staging.redis-url'];
    for (const alias of aliases) {
      const result = redact(alias);
      expect(result.text).toBe(alias);
      expect(result.matches).toHaveLength(0);
    }
  });
});

describe('mcp-reference-token: test_connection response is safe', () => {
  it('does not redact a test_connection OK response', () => {
    const response = JSON.stringify({
      alias: '@billing.dev.db-pass',
      tester: 'postgres',
      ok: true,
      latency_ms: 42,
      info: 'connected to PostgreSQL 16.2',
    });
    const result = redact(response);
    expect(result.text).toContain('"ok":true');
    expect(result.text).toContain('postgres');
    expect(result.text).not.toContain('<REDACTED');
  });

  it('does not redact a test_connection FAIL response (sanitized error)', () => {
    const response = JSON.stringify({
      alias: '@billing.dev.db-pass',
      tester: 'postgres',
      ok: false,
      latency_ms: 1999,
      error: 'connection refused — target unreachable',
    });
    const result = redact(response);
    expect(result.text).toContain('connection refused');
    expect(result.matches).toHaveLength(0);
  });
});

describe('mcp-reference-token: defense-in-depth — leaked value gets redacted', () => {
  it('redacts a Stripe key if it accidentally appears in a response', () => {
    const leaked = `{"alias": "@billing.dev.stripe-key", "value": "${'sk'}_${'live'}_${X(26)}"}`;
    const result = redact(leaked);
    expect(result.text).not.toContain('sk_live_');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts an AWS key if it accidentally appears in a response', () => {
    const leaked = `{"alias": "@billing.dev.aws-key", "value": "AKIA${'EXAMPLE'.repeat(2)}EX"}`;
    const result = redact(leaked);
    expect(result.text).not.toMatch(/\bAKIA/);
    expect(result.matches.length).toBe(1);
  });

  it('redacts a postgres URI if it accidentally appears in an error message', () => {
    const leaked = `{"error": "failed to connect: postgres://user:${'p'}assword@db.example.com:5432/app"}`;
    const result = redact(leaked);
    expect(result.text).not.toContain('password');
    expect(result.text).toContain('"error"');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts a GitHub PAT if it accidentally appears in a response', () => {
    const leaked = `{"token": "${'ghp'}_${X(36)}"}`;
    const result = redact(leaked);
    expect(result.text).not.toMatch(/\bghp_/);
    expect(result.matches.length).toBe(1);
  });
});

describe('mcp-reference-token: redact_text tool patterns are applied', () => {
  it('redacts common secret patterns in user-provided text via the redact_text tool path', () => {
    const text = `My API key is ${'sk'}-${'proj'}-${X(36)} and my DB is postgres://user:${'p'}ass@host/db`;
    const result = redact(text);
    expect(result.text).not.toContain('sk-proj-');
    expect(result.text).not.toContain('pass@host');
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });

  it('returns match summary metadata with bounded previews', () => {
    const fullToken = `${'ghp'}_${X(36)}`;
    const text = `Token: ${fullToken}`;
    const result = redact(text);
    for (const m of result.matches) {
      expect(m.preview.length).toBeLessThanOrEqual(16);
      expect(m.preview).not.toEqual(fullToken);
    }
  });
});

describe('mcp-reference-token: who_am_i response is safe', () => {
  it('does not redact a who_am_i response', () => {
    const response = JSON.stringify({
      user_id: 'u_abc123def456',
      email: 'alice@example.com',
      org_name: 'Acme Inc',
      org_role: 'owner',
      projects: [
        { name: 'billing', role: 'developer' },
        { name: 'arkey', role: 'lead' },
      ],
    });
    const result = redact(response);
    expect(result.text).toBe(response);
    expect(result.matches).toHaveLength(0);
  });
});
