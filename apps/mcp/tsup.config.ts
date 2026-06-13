import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

export default defineConfig({
  entry: { index: 'src/index.ts' },
  define: { __KEYNV_VERSION__: JSON.stringify(pkg.version) },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  shims: false,
  splitting: false,
  treeshake: true,
  minify: false,
  // Make the published bin directly executable (matches apps/cli).
  banner: { js: '#!/usr/bin/env node' },
  noExternal: [
    /^@keynv\//,
    'ioredis',
    'mysql2',
    'pg',
    'pg-cloudflare',
    'pg-connection-string',
    'pg-pool',
    'pg-protocol',
    'pg-types',
    'pgpass',
    'denque',
    'cluster-key-slot',
    'redis-errors',
    'redis-parser',
    'standard-as-callback',
    'lru-cache',
  ],
  external: ['@modelcontextprotocol/sdk', '@napi-rs/keyring', 'ssh2', 'cpu-features'],
});
