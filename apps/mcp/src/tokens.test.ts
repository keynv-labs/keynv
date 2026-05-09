import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetTokenStoreForTests, consumeReferenceToken, issueReferenceToken } from './tokens.js';

afterEach(() => {
  _resetTokenStoreForTests();
  vi.useRealTimers();
});

describe('reference tokens', () => {
  it('issues a token bound to an alias', () => {
    const issued = issueReferenceToken('@billing.dev.k');
    expect(issued.reference_token).toMatch(/^keynv-ref:/);
    expect(new Date(issued.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('resolves once and only once', () => {
    const issued = issueReferenceToken('@billing.dev.k');
    expect(consumeReferenceToken(issued.reference_token)).toBe('@billing.dev.k');
    // Second consumption fails — single-use.
    expect(consumeReferenceToken(issued.reference_token)).toBeNull();
  });

  it('rejects an unknown token', () => {
    expect(consumeReferenceToken('keynv-ref:does-not-exist')).toBeNull();
  });

  it('expires after the documented TTL', () => {
    vi.useFakeTimers();
    const issued = issueReferenceToken('@billing.dev.k');
    vi.advanceTimersByTime(60_001);
    expect(consumeReferenceToken(issued.reference_token)).toBeNull();
  });
});
