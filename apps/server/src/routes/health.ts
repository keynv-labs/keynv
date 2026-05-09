import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/index.js';

interface HealthDeps {
  db: Db;
  version: string;
  /**
   * Surface the public-registration flag so the web client can decide
   * whether to render /register or redirect to /login. Frontend reads
   * this on the /register page mount.
   */
  publicRegistrationEnabled: boolean;
}

export function healthRoute(deps: HealthDeps): Hono {
  const r = new Hono();
  r.get('/', async (c) => {
    let dbOk = false;
    try {
      const rows = (await deps.db.all(sql`SELECT 1 AS ok`)) as Array<{ ok: number }>;
      dbOk = rows[0]?.ok === 1;
    } catch {
      dbOk = false;
    }
    return c.json({
      ok: dbOk,
      version: deps.version,
      db: dbOk ? 'ok' : 'fail',
      capabilities: {
        public_registration: deps.publicRegistrationEnabled,
      },
    });
  });
  return r;
}
