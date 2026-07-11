import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { configureArgon2 } from './auth/password.js';
import { maybeAutoBootstrap } from './auto-bootstrap.js';
import { openDb } from './db/index.js';
import { loadOrCreateKek } from './kek/load.js';
import { loadEnv } from './lib/env.js';
import { configureTrustedProxyCount } from './lib/ip.js';
import { resolveJwtSecret } from './lib/jwt-secret.js';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg: { version: string } = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf8'),
);
export const VERSION = pkg.version;

async function main(): Promise<void> {
  const env = loadEnv();
  configureTrustedProxyCount(env.KEYNV_TRUSTED_PROXY_COUNT);
  configureArgon2({
    memoryKib: env.KEYNV_ARGON2_MEMORY_KIB,
    timeCost: env.KEYNV_ARGON2_TIME_COST,
    parallelism: env.KEYNV_ARGON2_PARALLELISM,
  });
  await maybeAutoBootstrap(env);
  const { db } = openDb({ path: env.KEYNV_DB_PATH, migrate: true, verbose: true });
  const kek = await loadOrCreateKek({ path: env.KEYNV_MASTER_KEY_FILE, generateIfMissing: true });
  const jwtSecret = resolveJwtSecret({
    envValue: env.KEYNV_JWT_SECRET,
    path: env.KEYNV_JWT_SECRET_FILE,
  });

  const app = createApp({
    db,
    jwtSecret,
    accessTtlS: env.KEYNV_ACCESS_TOKEN_TTL_S,
    refreshTtlS: env.KEYNV_REFRESH_TOKEN_TTL_S,
    webUrl: env.KEYNV_WEB_URL,
    getKek: () => kek,
    version: VERSION,
    rateLimitPerMinute: env.KEYNV_RATE_LIMIT_PER_MINUTE,
    publicRegistrationEnabled: env.KEYNV_PUBLIC_REGISTRATION,
    registerRateLimitPerMinute: env.KEYNV_REGISTER_RATE_LIMIT_PER_MINUTE,
    browserPollRateLimitPerMinute: env.KEYNV_BROWSER_POLL_RATE_LIMIT_PER_MINUTE,
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
