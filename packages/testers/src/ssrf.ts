/**
 * SSRF protection for testers. Blocks connections to internal/private
 * IP addresses and well-known metadata endpoints that should never be
 * reachable from a secret-validation request.
 */

const PRIVATE_CIDRS = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.0[0-2]\./,
  /^192\.168\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^224\./,
  /^240\./,
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
]);

function isLoopbackAllowed(): boolean {
  return !!process.env['KEYNV_ALLOW_LOOPBACK_TESTERS'];
}

export function isBlockedHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) {
    if (isLoopbackAllowed() && lower === 'localhost') return false;
    return true;
  }
  if (lower === '0.0.0.0' || lower === '[::]' || lower === '[::1]') return !isLoopbackAllowed();
  for (const re of PRIVATE_CIDRS) {
    if (re.test(lower)) {
      if (isLoopbackAllowed() && /^127\./.test(lower)) return false;
      return true;
    }
  }
  return false;
}

export function isBlockedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    return isBlockedHost(parsed.hostname);
  } catch {
    return true;
  }
}
