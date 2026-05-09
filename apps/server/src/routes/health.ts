import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/index.js';

export function healthRoute(deps: { db: Db; version: string }): Hono {
  const r = new Hono();
  r.get('/', async (c) => {
    let dbOk = false;
    try {
      const rows = (await deps.db.all(sql`SELECT 1 AS ok`)) as Array<{ ok: number }>;
      dbOk = rows[0]?.ok === 1;
    } catch {
      dbOk = false;
    }
    return c.json({ ok: dbOk, version: deps.version, db: dbOk ? 'ok' : 'fail' });
  });
  return r;
}
