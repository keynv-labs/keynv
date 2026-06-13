/**
 * SSRF protection for testers. A tester runs with a real secret value and
 * the user's connection target, so it must never be coaxed into hitting an
 * internal/loopback/link-local/metadata address.
 *
 * Defense in depth:
 *  - Literal-IP classification covers IPv4 (incl. decimal/hex integer forms),
 *    IPv6 (loopback, unspecified, link-local fe80::/10, ULA fc00::/7,
 *    multicast, IPv4-mapped ::ffff:a.b.c.d), and the reserved/TEST-NET ranges.
 *  - {@link isBlockedHostResolved} additionally resolves a *hostname* via DNS
 *    and rejects it if ANY resolved address is internal. This closes the
 *    "public DNS name with an A record pointing at 127.0.0.1 / 169.254.169.254"
 *    bypass that a pure string blacklist cannot see.
 *
 * Residual: a determined attacker controlling DNS can still rebind between
 * our check and the client library's own resolution (TOCTOU). Pinning the
 * resolved IP into every client (pg/mysql/redis/ssh) without breaking TLS
 * SNI is out of scope here; the resolved check removes the trivial bypass.
 */
import { lookup } from 'node:dns/promises';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
]);

function isLoopbackAllowed(): boolean {
  return !!process.env['KEYNV_ALLOW_LOOPBACK_TESTERS'];
}

/** Strip brackets and an IPv6 zone id; lowercase. */
function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/%.*$/, '');
}

/**
 * If `host` is a bare integer (2130706433) or hex (0x7f000001) IPv4, return
 * its dotted-quad form; otherwise null. These numeric forms are accepted by
 * many resolvers/clients and would otherwise slip past dotted-quad CIDRs.
 */
function normalizeNumericIPv4(host: string): string | null {
  let n: number | null = null;
  if (/^\d+$/.test(host)) n = Number(host);
  else if (/^0x[0-9a-f]+$/i.test(host)) n = Number.parseInt(host.slice(2), 16);
  if (n === null || !Number.isInteger(n) || n < 0 || n > 0xffffffff) return null;
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
}

function isDottedIPv4(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

/** True if a dotted-quad IPv4 is private/loopback/link-local/reserved/metadata. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return false;
  }
  const [a, b, c] = parts as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local + cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24, TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast 224/4 + reserved 240/4 + 255.255.255.255
  return false;
}

/** True if an IPv6 literal is loopback/unspecified/link-local/ULA/multicast/mapped-internal. */
function isPrivateIPv6(ip: string): boolean {
  const s = normalizeHost(ip);
  // IPv4-mapped / -embedded in dotted form: ::ffff:127.0.0.1, ::127.0.0.1
  const mapped = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (s.startsWith('::') && mapped) return isPrivateIPv4(mapped[1] as string);
  if (s === '::1') return true; // loopback
  if (s === '::') return true; // unspecified
  if (/^fe[89ab]/.test(s)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(s)) return true; // unique local fc00::/7
  if (/^ff/.test(s)) return true; // multicast ff00::/8
  if (/^fec/.test(s)) return true; // deprecated site-local fec0::/10
  return false;
}

/**
 * Synchronous classification of a host *literal*. Returns true for blocked
 * hostnames and for IP literals (IPv4 dotted/numeric, IPv6) that resolve to
 * an internal range. Returns false for a plain hostname — use
 * {@link isBlockedHostResolved} to also check what it resolves to.
 */
export function isBlockedHost(host: string): boolean {
  let h = normalizeHost(host);
  if (BLOCKED_HOSTNAMES.has(h)) {
    if (isLoopbackAllowed() && h === 'localhost') return false;
    return true;
  }
  const numeric = normalizeNumericIPv4(h);
  if (numeric) h = numeric;
  if (isDottedIPv4(h)) {
    const blocked = isPrivateIPv4(h);
    if (blocked && isLoopbackAllowed() && /^127\./.test(h)) return false;
    return blocked;
  }
  if (h.includes(':')) {
    const blocked = isPrivateIPv6(h);
    if (blocked && isLoopbackAllowed() && h === '::1') return false;
    return blocked;
  }
  return false;
}

function isIpLiteral(h: string): boolean {
  return isDottedIPv4(h) || h.includes(':') || normalizeNumericIPv4(h) !== null;
}

/**
 * Like {@link isBlockedHost} but, for a hostname, also resolves it via DNS
 * and blocks if ANY resolved address is internal. Async because it does I/O.
 */
export async function isBlockedHostResolved(host: string): Promise<boolean> {
  if (isBlockedHost(host)) return true;
  const h = normalizeHost(host);
  // Already an IP literal → isBlockedHost was authoritative.
  if (isIpLiteral(h)) return false;
  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    // Unresolvable: let the tester surface its own connection error.
    return false;
  }
  return addrs.some((a) => isBlockedHost(a.address));
}

/** Synchronous URL guard (literal host only). */
export function isBlockedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    return isBlockedHost(parsed.hostname);
  } catch {
    return true;
  }
}

/** URL guard that also resolves the hostname via DNS. */
export async function isBlockedUrlResolved(urlStr: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return true;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  return isBlockedHostResolved(parsed.hostname);
}
