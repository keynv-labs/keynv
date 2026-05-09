import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { maybeAutoBootstrap } from './auto-bootstrap.js';
import { openDb } from './db/index.js';
import { loadOrCreateKek } from './kek/load.js';
import { loadEnv } from './lib/env.js';

export const VERSION = '0.0.0-phase1';

async function main(): Promise<void> {
  const env = loadEnv();
  await maybeAutoBootstrap(env);
  const { db } = openDb({ path: env.KEYNV_DB_PATH, migrate: true, verbose: true });
  const kek = await loadOrCreateKek({ path: env.KEYNV_MASTER_KEY_FILE, generateIfMissing: false });

  const app = createApp({
    db,
    jwtSecret: env.KEYNV_JWT_SECRET,
    accessTtlS: env.KEYNV_ACCESS_TOKEN_TTL_S,
    refreshTtlS: env.KEYNV_REFRESH_TOKEN_TTL_S,
    getKek: () => kek,
    version: VERSION,
    rateLimitPerMinute: env.KEYNV_RATE_LIMIT_PER_MINUTE,
    publicRegistrationEnabled: env.KEYNV_PUBLIC_REGISTRATION,
    registerRateLimitPerMinute: env.KEYNV_REGISTER_RATE_LIMIT_PER_MINUTE,
  });

  serve({ fetch: app.fetch, port: env.KEYNV_PORT });
  console.log(`keynv-server listening on http://localhost:${env.KEYNV_PORT}`);
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
