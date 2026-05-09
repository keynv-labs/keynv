import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { runTest } from './run.js';
import type { ResolvedSecret, Tester, TestResult } from './types.js';

const FakeTarget = z.object({ host: z.string().min(1) });
type FakeTarget = z.infer<typeof FakeTarget>;

function fakeTester(behavior: (s: ResolvedSecret, t: FakeTarget) => Promise<TestResult>): Tester<FakeTarget> {
  return {
    type: 'http',
    schema: FakeTarget,
    test: behavior,
  };
}

describe('runTest', () => {
  it('returns the tester result on success', async () => {
    const t = fakeTester(async () => ({ ok: true, latency_ms: 10 }));
    const r = await runTest({
      tester: t,
      secret: { alias: '@x.dev.k', value: 'pw' },
      target: { host: 'a' },
    });
    expect(r.ok).toBe(true);
  });

  it('returns a sanitized error from the tester', async () => {
    const t = fakeTester(async () => ({
      ok: false,
      latency_ms: 12,
      error: 'auth failed for hunter2',
    }));
    const r = await runTest({
      tester: t,
      secret: { alias: '@x.dev.k', value: 'hunter2' },
      target: { host: 'a' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('auth failed for <redacted>');
  });

  it('returns a validation error for a malformed target', async () => {
    const t = fakeTester(async () => ({ ok: true, latency_ms: 0 }));
    const r = await runTest({
      tester: t,
      secret: { alias: '@x.dev.k', value: 'p' },
      target: { host: '' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid target/);
  });

  it('enforces a hard timeout', async () => {
    const t = fakeTester(
      () => new Promise<TestResult>(() => undefined), // never resolves
    );
    const r = await runTest({
      tester: t,
      secret: { alias: '@x.dev.k', value: 'p' },
      target: { host: 'a' },
      timeoutMs: 50,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timed out/);
  });

  it('catches synchronous throws from the tester', async () => {
    const t = fakeTester(async () => {
      throw new Error('boom hunter2');
    });
    const r = await runTest({
      tester: t,
      secret: { alias: '@x.dev.k', value: 'hunter2' },
      target: { host: 'a' },
    });
    expect(r.error).toBe('boom <redacted>');
  });
});
