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

const API_CAPABILITIES = {
  api: {
    current: 'v1',
    supported: ['v1'],
    stability: 'pre-1.0',
    min_cli_version: '0.1.0-rc.21',
  },
  features: {
    batch_secret_create: true,
    environment_management: true,
    health_probes: true,
    prometheus_metrics: true,
  },
} as const;

async function checkDb(db: Db): Promise<boolean> {
  try {
    const rows = (await db.all(sql`SELECT 1 AS ok`)) as Array<{ ok: number }>;
    return rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

function healthPayload(deps: HealthDeps, dbOk: boolean) {
  return {
    ok: dbOk,
    version: deps.version,
    db: dbOk ? 'ok' : 'fail',
    capabilities: {
      public_registration: deps.publicRegistrationEnabled,
      ...API_CAPABILITIES,
    },
  };
}

export function healthRoute(deps: HealthDeps): Hono {
  const r = new Hono();
  r.get('/', async (c) => {
    const dbOk = await checkDb(deps.db);
    return c.json(healthPayload(deps, dbOk));
  });
  r.get('/live', (c) => {
    return c.json({ ok: true, status: 'live', version: deps.version });
  });
  r.get('/ready', async (c) => {
    const dbOk = await checkDb(deps.db);
    return c.json(healthPayload(deps, dbOk), dbOk ? 200 : 503);
  });
  return r;
}
