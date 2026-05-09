import { Hono } from 'hono';
import type { Db } from '../db/index.js';
import { authedChain } from '../lib/middleware-chain.js';

interface WhoamiDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

export function whoamiRoute(deps: WhoamiDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));
  r.get('/', (c) => {
    const u = c.var.user;
    return c.json({
      id: u.id,
      email: u.email,
      org_id: u.org_id,
      org_role: u.org_role,
      memberships: u.memberships,
    });
  });
  return r;
}
