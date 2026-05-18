/**
 * Per-key fixed-window-of-1-minute rate limit. In-memory; sufficient
 * for single-instance self-host deployments (the only supported topology
 * until Phase 6 keynv Cloud). Multi-instance deployments need a shared
 * store (Redis); the existing token-bucket interface lets us swap in
 * a different backend later without touching route handlers.
 *
 * Two flavours:
 *   - rateLimitMiddleware → keys on c.var.user.id (authenticated routes,
 *     closes Phase 5 audit Finding A1).
 *   - ipRateLimitMiddleware → keys on the client IP via the X-Forwarded-For
 *     chain or the socket fallback. Used for unauthenticated routes
 *     (POST /v1/auth/register today) so abuse is throttled before it
 *     reaches the password-hashing path.
 *
 * The 'rate_limited' error code is declared in lib/errors.ts.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { jsonError } from './errors.js';
import { clientIp } from './ip.js';
import { recordDomainEvent } from './metrics.js';

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

interface Limiter {
  /** Returns true if the request is allowed; false → caller responds 429. */
  consume(c: Context, key: string): boolean;
}

function makeLimiter(limit: number): Limiter {
  const buckets = new Map<string, Bucket>();
  let requestsSinceCleanup = 0;

  return {
    consume(c, key) {
      if (limit <= 0) return true;
      const now = Date.now();
      requestsSinceCleanup += 1;
      if (requestsSinceCleanup >= CLEANUP_EVERY_N) {
        for (const [k, b] of buckets) {
          if (now - b.windowStartMs > WINDOW_MS) buckets.delete(k);
        }
        requestsSinceCleanup = 0;
      }

      let bucket = buckets.get(key);
      if (!bucket || now - bucket.windowStartMs > WINDOW_MS) {
        bucket = { count: 0, windowStartMs: now };
        buckets.set(key, bucket);
      }
      bucket.count += 1;

      if (bucket.count > limit) {
        const resetSeconds = Math.max(
          1,
          Math.ceil((bucket.windowStartMs + WINDOW_MS - now) / 1000),
        );
        c.header('Retry-After', String(resetSeconds));
        c.header('X-RateLimit-Limit', String(limit));
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', String(Math.ceil((bucket.windowStartMs + WINDOW_MS) / 1000)));
        return false;
      }

      c.header('X-RateLimit-Limit', String(limit));
      c.header('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
      return true;
    },
  };
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
  const limiter = makeLimiter(deps.perMinute);
  return async (c, next) => {
    if (deps.perMinute <= 0) return next();
    const user = c.var.user;
    if (!user) return next();
    if (!limiter.consume(c, user.id)) {
      recordDomainEvent(c, 'rate_limit_rejection');
      const reset = c.res.headers.get('Retry-After') ?? '60';
      return jsonError(c, 'rate_limited', `Too many requests. Retry in ${reset}s.`);
    }
    return next();
  };
}

/**
 * IP-keyed Hono middleware for unauthenticated routes. Tighter budget
 * than the user-keyed variant — register/login flows don't have a
 * legitimate burst pattern. Keys on the X-Forwarded-For chain when
 * behind a reverse proxy (Coolify/Traefik), socket-address otherwise.
 */
export function ipRateLimitMiddleware(deps: RateLimitDeps): MiddlewareHandler {
  const limiter = makeLimiter(deps.perMinute);
  return async (c, next) => {
    if (deps.perMinute <= 0) return next();
    const ip = clientIp(c);
    if (!limiter.consume(c, ip)) {
      recordDomainEvent(c, 'rate_limit_rejection');
      const reset = c.res.headers.get('Retry-After') ?? '60';
      return jsonError(c, 'rate_limited', `Too many requests. Retry in ${reset}s.`);
    }
    return next();
  };
}
