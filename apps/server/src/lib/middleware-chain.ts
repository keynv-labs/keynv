/**
 * The standard "authenticated + rate-limited" middleware chain. Mount
 * with `r.use('*', ...authedChain(deps))` on every authed route group.
 *
 * Order is intentional: authMiddleware runs first (loads user into
 * c.var.user); rateLimitMiddleware keys on c.var.user.id and is a
 * no-op when KEYNV_RATE_LIMIT_PER_MINUTE is 0.
 */
import type { MiddlewareHandler } from 'hono';
import { authMiddleware } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import { rateLimitMiddleware } from './rate-limit.js';

const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;

interface ChainDeps {
  db: Db;
  jwtSecret: string;
  /** Optional; falls back to the default if not passed. */
  rateLimitPerMinute?: number | undefined;
}

export function authedChain(deps: ChainDeps): MiddlewareHandler[] {
  return [
    authMiddleware(() => ({ db: deps.db, jwtSecret: deps.jwtSecret })),
    rateLimitMiddleware({
      perMinute: deps.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
    }),
  ];
}
