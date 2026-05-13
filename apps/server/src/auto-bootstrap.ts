/**
 * Server-startup auto-bootstrap. Used by Coolify / single-container
 * deploys where running a separate `bootstrap.js` step before the main
 * service is awkward.
 *
 * Activation: master.key file is missing AND both
 *   KEYNV_BOOTSTRAP_OWNER_EMAIL
 *   KEYNV_BOOTSTRAP_OWNER_PASSWORD
 * are set in the environment.
 *
 * After a successful first run the master.key file exists, so this
 * function becomes a no-op on subsequent restarts and the operator
 * can safely remove the bootstrap env vars from the deployment.
 *
 * The two-step interactive bootstrap script (`dist/bootstrap.js`)
 * remains the recommended path for shell-friendly deploys (compose,
 * k8s with `kubectl run`). This auto-flavor is for PaaS scenarios.
 */

import { existsSync } from 'node:fs';
import { hashPassword } from './auth/password.js';
import { openDb, schema } from './db/index.js';
import { loadOrCreateKek } from './kek/load.js';
import type { ServerEnvT } from './lib/env.js';
import { newOrgId, newUserId } from './lib/id.js';
import { makeLogger } from './lib/logger.js';

export async function maybeAutoBootstrap(env: ServerEnvT): Promise<void> {
  const log = makeLogger('info');
  if (existsSync(env.KEYNV_MASTER_KEY_FILE)) return;

  const ownerEmail = process.env['KEYNV_BOOTSTRAP_OWNER_EMAIL'];
  const ownerPassword = process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'];
  const orgName = process.env['KEYNV_BOOTSTRAP_ORG_NAME'] ?? 'default';

  if (!ownerEmail || !ownerPassword) return;

  if (ownerPassword.length < 12) {
    throw new Error('KEYNV_BOOTSTRAP_OWNER_PASSWORD must be at least 12 characters');
  }

  log.info('master key missing — initializing fresh deployment');

  await loadOrCreateKek({ path: env.KEYNV_MASTER_KEY_FILE, generateIfMissing: true });
  const { db } = openDb({ path: env.KEYNV_DB_PATH, migrate: true, verbose: false });

  const existing = await db.select().from(schema.orgs).limit(1);
  if (existing.length > 0) {
    log.info('org row already present — skipping owner creation');
    return;
  }

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

  log.info({ orgId, orgName }, 'created org');
  log.info({ userId, email: ownerEmail }, 'created owner');
  log.info('you can now unset KEYNV_BOOTSTRAP_* env vars from the deployment');

  // Defensive: don't keep the password in this process's env after use.
  delete process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'];
}
