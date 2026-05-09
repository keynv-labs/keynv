/**
 * Per-user, fixed-window-of-1-minute rate limit. In-memory; sufficient
 * for single-instance self-host deployments (the only supported topology
 * until Phase 6 keynv Cloud). Multi-instance deployments need a shared
 * store (Redis); the existing token-bucket interface lets us swap in
 * a different backend later without touching route handlers.
 *
 * Closes Phase 5 audit Finding A1 — the threat model called out
 * "spam keynv exec to exhaust subprocess slots" with no enforcement
 * shipped through Phase 4. The 'rate_limited' error code was already
 * declared in lib/errors.ts.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { jsonError } from './errors.js';

interface Bucket {
  count: number;
  windowStartMs: number;
}

const WINDOW_MS = 60_000;

/**
 * Lazy GC so the Map doesn't grow forever in a long-running process.
 * Triggered every CLEANUP_EVERY_N requests; sweeps buckets whose
 * window has expired. Cheap (Map iteration over at most N entries).
 */
const CLEANUP_EVERY_N = 1024;
let requestsSinceCleanup = 0;

function cleanup(buckets: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartMs > WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

interface RateLimitDeps {
  /** 0 disables the limiter entirely. */
  perMinute: number;
}

/**
 * Hono middleware. MUST be installed AFTER authMiddleware so c.var.user
 * is populated; the limiter keys on user.id and is a no-op for
 * unauthenticated requests (those don't reach this middleware in
 * practice, but the guard makes the helper safe to chain anywhere).
 */
export function rateLimitMiddleware(deps: RateLimitDeps): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();
  const limit = deps.perMinute;

  return async (c: Context, next) => {
    if (limit <= 0) return next();
    const user = c.var.user;
    if (!user) return next();

    const now = Date.now();
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= CLEANUP_EVERY_N) {
      cleanup(buckets, now);
      requestsSinceCleanup = 0;
    }

    let bucket = buckets.get(user.id);
    if (!bucket || now - bucket.windowStartMs > WINDOW_MS) {
      bucket = { count: 0, windowStartMs: now };
      buckets.set(user.id, bucket);
    }
    bucket.count += 1;

    if (bucket.count > limit) {
      const resetSeconds = Math.max(1, Math.ceil((bucket.windowStartMs + WINDOW_MS - now) / 1000));
      c.header('Retry-After', String(resetSeconds));
      c.header('X-RateLimit-Limit', String(limit));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(Math.ceil((bucket.windowStartMs + WINDOW_MS) / 1000)));
      return jsonError(c, 'rate_limited', `Too many requests. Retry in ${resetSeconds}s.`);
    }

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    return next();
  };
}
