import { Hono } from 'hono';
import type { Db } from '../db/index.js';
import { authMiddleware } from '../auth/middleware.js';

interface WhoamiDeps {
  db: Db;
  jwtSecret: string;
}

export function whoamiRoute(deps: WhoamiDeps): Hono {
  const r = new Hono();
  r.use('*', authMiddleware(() => ({ db: deps.db, jwtSecret: deps.jwtSecret })));
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
