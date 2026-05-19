import { describe, expect, it } from 'vitest';
import { FingerprintRegistry, fingerprint } from './registry.js';

describe('FingerprintRegistry', () => {
  it('fingerprints are stable sha256[:8]', () => {
    expect(fingerprint('hello')).toBe('2cf24dba');
    expect(fingerprint('hello')).toBe(fingerprint('hello'));
    expect(fingerprint('hello!')).not.toBe(fingerprint('hello'));
  });

  it('register is idempotent on identical values', () => {
    const r = new FingerprintRegistry();
    r.register('super-secret-token-9000');
    r.register('super-secret-token-9000');
    expect(r.size()).toBe(1);
  });

  it('values() returns all distinct registered strings', () => {
    const r = new FingerprintRegistry();
    r.register('a-value');
    r.register('b-value');
    const vals = r.values();
    expect(vals).toContain('a-value');
    expect(vals).toContain('b-value');
    expect(vals).toHaveLength(2);
  });

  it('rejects empty values', () => {
    const r = new FingerprintRegistry();
    expect(() => r.register('')).toThrow(/empty value/);
  });

  it('clear empties the registry', () => {
    const r = new FingerprintRegistry();
    r.register('foo');
    r.register('bar');
    r.clear();
    expect(r.size()).toBe(0);
    expect(r.values()).toHaveLength(0);
  });
});
