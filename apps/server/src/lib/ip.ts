/**
 * Extract the originating client IP from a Hono request context.
 *
 * keynv-server is normally deployed behind a reverse proxy (Coolify's
 * Traefik, Caddy in deploy/, NGINX in custom k8s) that forwards the
 * real client address via X-Forwarded-For. We trust the leftmost entry
 * in that chain. When no proxy header is present (local dev, raw
 * docker compose with the server exposed directly) we fall back to
 * the socket address from the underlying Node request — that is the
 * actual remote peer of the TCP connection.
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

export function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();

  // @hono/node-server exposes the underlying IncomingMessage on
  // c.env.incoming. Other adapters (Bun, Deno, Workers) may surface
  // it elsewhere; we keep the lookup defensive so no platform shape
  // throws here.
  const env = c.env as { incoming?: NodeReqLike } | undefined;
  const sockAddr = env?.incoming?.socket?.remoteAddress ?? env?.incoming?.connection?.remoteAddress;
  if (sockAddr) return sockAddr;

  return 'unknown';
}
