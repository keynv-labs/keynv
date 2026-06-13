import { describe, expect, it, vi } from 'vitest';

// Deterministic, offline DNS: a couple of "malicious" names resolve to
// internal addresses, one resolves to a public address.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    if (host === 'rebind.evil.test') return [{ address: '127.0.0.1', family: 4 }];
    if (host === 'metadata.evil.test') return [{ address: '169.254.169.254', family: 4 }];
    if (host === 'split.evil.test')
      return [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.5', family: 4 },
      ];
    if (host === 'public.test') return [{ address: '93.184.216.34', family: 4 }];
    throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
  }),
}));

import {
  isBlockedHost,
  isBlockedHostResolved,
  isBlockedUrl,
  isBlockedUrlResolved,
} from './ssrf.js';

describe('isBlockedHost — literal IPv4', () => {
  it.each([
    ['loopback', '127.0.0.1'],
    ['loopback /8', '127.1.2.3'],
    ['10/8', '10.0.0.5'],
    ['172.16/12', '172.16.0.1'],
    ['172.31 edge', '172.31.255.255'],
    ['192.168/16', '192.168.1.1'],
    ['link-local + metadata', '169.254.169.254'],
    ['0.0.0.0/8', '0.0.0.0'],
    ['CGNAT 100.64/10', '100.64.0.1'],
    ['TEST-NET-1', '192.0.2.1'],
    ['TEST-NET-2', '198.51.100.7'],
    ['TEST-NET-3', '203.0.113.7'],
    ['multicast', '224.0.0.1'],
    ['reserved 240/4', '240.0.0.1'],
    ['decimal integer form of 127.0.0.1', '2130706433'],
    ['hex form of 127.0.0.1', '0x7f000001'],
  ])('blocks %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each([
    ['public DNS', '8.8.8.8'],
    ['public', '93.184.216.34'],
    ['172.15 (just below private)', '172.15.0.1'],
    ['172.32 (just above private)', '172.32.0.1'],
    ['198.51.99 (not TEST-NET-2)', '198.51.99.7'],
  ])('allows %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(false);
  });
});

describe('isBlockedHost — literal IPv6 + hostnames', () => {
  it.each([
    ['v6 loopback', '::1'],
    ['v6 loopback bracketed', '[::1]'],
    ['v6 unspecified', '::'],
    ['v6 link-local', 'fe80::1'],
    ['v6 ULA', 'fd00::1'],
    ['v6 ULA fc', 'fc00::1'],
    ['v6 multicast', 'ff02::1'],
    ['v4-mapped loopback', '::ffff:127.0.0.1'],
    ['localhost', 'localhost'],
    ['gcp metadata', 'metadata.google.internal'],
  ])('blocks %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it('allows a public IPv6 address', () => {
    expect(isBlockedHost('2606:4700:4700::1111')).toBe(false);
  });

  it('does not classify a bare hostname synchronously', () => {
    expect(isBlockedHost('rebind.evil.test')).toBe(false);
  });
});

describe('isBlockedHostResolved — DNS-aware (closes the rebinding bypass)', () => {
  it('blocks a public hostname that resolves to loopback', async () => {
    expect(await isBlockedHostResolved('rebind.evil.test')).toBe(true);
  });

  it('blocks a public hostname that resolves to the cloud metadata IP', async () => {
    expect(await isBlockedHostResolved('metadata.evil.test')).toBe(true);
  });

  it('blocks when ANY resolved address is internal', async () => {
    expect(await isBlockedHostResolved('split.evil.test')).toBe(true);
  });

  it('allows a hostname that resolves only to public addresses', async () => {
    expect(await isBlockedHostResolved('public.test')).toBe(false);
  });

  it('does not block an unresolvable host (tester surfaces its own error)', async () => {
    expect(await isBlockedHostResolved('nope.invalid.test')).toBe(false);
  });
});

describe('isBlockedUrl / isBlockedUrlResolved', () => {
  it('blocks non-http(s) protocols', () => {
    expect(isBlockedUrl('file:///etc/passwd')).toBe(true);
    expect(isBlockedUrl('gopher://x')).toBe(true);
  });

  it('blocks a malformed URL', () => {
    expect(isBlockedUrl('not a url')).toBe(true);
  });

  it('resolves the URL host via DNS', async () => {
    expect(await isBlockedUrlResolved('http://rebind.evil.test/path')).toBe(true);
    expect(await isBlockedUrlResolved('https://public.test/path')).toBe(false);
  });
});
