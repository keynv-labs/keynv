import { describe, expect, it } from 'vitest';
import { sanitizeResult } from './sanitize.js';
import type { ResolvedSecret, TestResult } from './types.js';

describe('sanitizeResult', () => {
  it('redacts the literal secret value when it appears in the error', () => {
    const secret: ResolvedSecret = { alias: '@x.dev.k', value: 'super-pass-123' };
    const result: TestResult = { ok: false, latency_ms: 12, error: 'auth failed for super-pass-123' };
    expect(sanitizeResult(result, secret).error).toBe('auth failed for <redacted>');
  });

  it('redacts auxiliary fields too', () => {
    const secret: ResolvedSecret = {
      alias: '@x.dev.k',
      value: 'pass',
      fields: { username: 'super-rare-user' },
    };
    const result: TestResult = {
      ok: false,
      latency_ms: 12,
      error: "no such user 'super-rare-user'",
    };
    expect(sanitizeResult(result, secret).error).toBe("no such user '<redacted>'");
  });

  it('runs the redactor pattern bank over the error', () => {
    const secret: ResolvedSecret = { alias: '@x.dev.k', value: 'irrelevant' };
    const result: TestResult = {
      ok: false,
      latency_ms: 12,
      error: 'connection failed: postgres://app:hunter2@db.example.com/x',
    };
    const cleaned = sanitizeResult(result, secret).error ?? '';
    expect(cleaned).toContain('<REDACTED:postgres-uri>');
    expect(cleaned).not.toContain('hunter2');
  });

  it('passes ok=true results through unchanged', () => {
    const secret: ResolvedSecret = { alias: '@x.dev.k', value: 'p' };
    const result: TestResult = { ok: true, latency_ms: 24 };
    expect(sanitizeResult(result, secret)).toEqual(result);
  });
});
