/**
 * Run-once bootstrap: creates the master KEK file (if missing) and the
 * initial Owner account. Idempotent guards prevent accidental re-init.
 *
 * Usage:
 *   pnpm --filter @keynv/server bootstrap \
 *     --owner-email lead@team.com --owner-password '...' --org-name acme
 */

import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { hashPassword } from './auth/password.js';
import { openDb } from './db/index.js';
import { schema } from './db/index.js';
import { loadOrCreateKek } from './kek/load.js';
import { loadEnv } from './lib/env.js';
import { newOrgId, newUserId } from './lib/id.js';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'owner-email': { type: 'string' },
      'owner-password': { type: 'string' },
      'org-name': { type: 'string' },
    },
  });

  const ownerEmail = values['owner-email'];
  const ownerPassword = values['owner-password'];
  const orgName = values['org-name'] ?? 'default';
  if (!ownerEmail || !ownerPassword) {
    console.error('bootstrap: --owner-email and --owner-password are required');
    process.exit(2);
  }
  if (ownerPassword.length < 12) {
    console.error('bootstrap: owner password must be at least 12 characters');
    process.exit(2);
  }

  const env = loadEnv();
  if (existsSync(env.KEYNV_DB_PATH)) {
    console.error(`bootstrap: refusing to overwrite ${env.KEYNV_DB_PATH}; remove it manually first.`);
    process.exit(2);
  }

  await loadOrCreateKek({ path: env.KEYNV_MASTER_KEY_FILE, generateIfMissing: true });
  const { db } = openDb({ path: env.KEYNV_DB_PATH, migrate: true, verbose: true });

  const orgId = newOrgId();
  const userId = newUserId();
  await db.insert(schema.orgs).values({ id: orgId, name: orgName });
  await db.insert(schema.users).values({
    id: userId,
    org_id: orgId,
    email: ownerEmail,
    password_hash: await hashPassword(ownerPassword),
    org_role: 'owner',
  });

  // biome-ignore lint/suspicious/noConsoleLog: intentional bootstrap output
  console.log(`bootstrap: created org "${orgName}" (id=${orgId})`);
  // biome-ignore lint/suspicious/noConsoleLog: intentional bootstrap output
  console.log(`bootstrap: owner ${ownerEmail} (id=${userId})`);
  // biome-ignore lint/suspicious/noConsoleLog: intentional bootstrap output
  console.log(`bootstrap: master key file at ${env.KEYNV_MASTER_KEY_FILE}`);
  // biome-ignore lint/suspicious/noConsoleLog: intentional bootstrap output
  console.log('bootstrap: store the master key file safely; loss bricks the deployment.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
