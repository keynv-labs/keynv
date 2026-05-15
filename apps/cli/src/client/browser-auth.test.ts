import { describe, expect, it } from 'vitest';
import { parseRetryAfterMs } from './browser-auth.js';

describe('parseRetryAfterMs', () => {
  it('returns null for missing or empty values', () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs('')).toBeNull();
    expect(parseRetryAfterMs('   ')).toBeNull();
  });

  it('parses delta-seconds form (RFC 7231 §7.1.3)', () => {
    expect(parseRetryAfterMs('0')).toBe(0);
    expect(parseRetryAfterMs('30')).toBe(30_000);
    expect(parseRetryAfterMs('120')).toBe(120_000);
  });

  it('returns null for non-parseable junk', () => {
    expect(parseRetryAfterMs('soon')).toBeNull();
    expect(parseRetryAfterMs('30s')).toBeNull();
  });

  it('parses HTTP-date form into a forward-looking delta', () => {
    const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000).toUTCString();
    const ms = parseRetryAfterMs(fiveMinFromNow);
    expect(ms).not.toBeNull();
    // Allow a small jitter window for the round-trip through Date.parse.
    expect(ms ?? 0).toBeGreaterThan(4 * 60 * 1000);
    expect(ms ?? 0).toBeLessThan(6 * 60 * 1000);
  });

  it('returns 0 (not negative) for a past HTTP-date', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toUTCString();
    expect(parseRetryAfterMs(tenMinAgo)).toBe(0);
  });
});
