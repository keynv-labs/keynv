/**
 * Extract the originating client IP from a Hono request context.
 *
 * keynv-server is normally deployed behind a reverse proxy (Coolify's
 * Traefik, Caddy in deploy/, NGINX in custom k8s) that forwards the
 * real client address via X-Forwarded-For. When a trusted proxy count
 * is configured via KEYNV_TRUSTED_PROXY_COUNT we take the Nth entry
 * from the right — this is the IP added by the outermost trusted
 * proxy, which is closest to the real client. When no trusted proxy
 * count is set we fall back to the leftmost entry (legacy behavior),
 * which is unsafe unless the server is directly exposed without any
 * untrusted proxies in front.
 *
 * Returns 'unknown' as a last resort so the rate-limit Map always has
 * a stable key. Bucketing every unknown caller into one shared bucket
 * is intentionally conservative; it means the limiter is at worst
 * over-aggressive, never under-protective.
 */
import type { Context } from 'hono';

interface NodeReqLike {
  socket?: { remoteAddress?: string | null } | null;
  connection?: { remoteAddress?: string | null } | null;
}

/** Number of trusted reverse proxies in front of this server. */
let trustedProxyCount = 1;

export function configureTrustedProxyCount(count: number): void {
  trustedProxyCount = Math.max(0, count);
}

export function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // Take the Nth-from-right entry, where N = trustedProxyCount.
    // With 1 trusted proxy, the rightmost entry was added by our
    // proxy and the one before it is the real client.
    const idx = parts.length - trustedProxyCount - 1;
    const ip = parts[idx < 0 ? 0 : idx];
    if (ip) return ip;
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();

  const env = c.env as { incoming?: NodeReqLike } | undefined;
  const sockAddr = env?.incoming?.socket?.remoteAddress ?? env?.incoming?.connection?.remoteAddress;
  if (sockAddr) return sockAddr;

  return 'unknown';
}
