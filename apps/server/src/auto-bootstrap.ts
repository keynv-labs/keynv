/**
 * Server-startup initialization. Runs on every boot and is idempotent.
 *
 * It always ensures the master key exists (generating it on first boot)
 * so the server can start on a fresh volume WITHOUT any operator-provided
 * secret — no crash-loop, no separate bootstrap command.
 *
 * It additionally creates the first owner + org when, and only when, no
 * org exists yet AND both
 *   KEYNV_BOOTSTRAP_OWNER_EMAIL
 *   KEYNV_BOOTSTRAP_OWNER_PASSWORD  (>= 12 chars)
 * are set. Keying off org existence (rather than the master-key file)
 * means an operator can deploy first and add the owner vars on a later
 * restart. Missing or invalid bootstrap vars are warned about, never
 * fatal — the server still starts; the operator fixes the vars and
 * restarts, or registers the first user from the panel.
 */

import { hashPassword } from './auth/password.js';
import { openDb, schema } from './db/index.js';
import { loadOrCreateKek } from './kek/load.js';
import type { ServerEnvT } from './lib/env.js';
import { newOrgId, newUserId } from './lib/id.js';
import { makeLogger } from './lib/logger.js';

export async function maybeAutoBootstrap(env: ServerEnvT): Promise<void> {
  const log = makeLogger(env.KEYNV_LOG_LEVEL);

  // Always ensure the master key — this is what stops the fresh-deploy
  // crash-loop. Generating it with no owner yet is safe: it only wraps
  // project DEKs, which don't exist until the first project is created.
  await loadOrCreateKek({ path: env.KEYNV_MASTER_KEY_FILE, generateIfMissing: true });

  const ownerEmail = process.env['KEYNV_BOOTSTRAP_OWNER_EMAIL'];
  const ownerPassword = process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'];
  const orgName = process.env['KEYNV_BOOTSTRAP_ORG_NAME'] ?? 'default';

  const { db, raw } = openDb({ path: env.KEYNV_DB_PATH, migrate: true, verbose: false });
  try {
    const existing = await db.select().from(schema.orgs).limit(1);
    if (existing.length > 0) return; // already initialized

    if (!ownerEmail || !ownerPassword) {
      log.warn(
        'no owner account exists yet. Set KEYNV_BOOTSTRAP_OWNER_EMAIL + ' +
          'KEYNV_BOOTSTRAP_OWNER_PASSWORD (>=12 chars) and restart, or set ' +
          'KEYNV_PUBLIC_REGISTRATION=true to register the first user from the panel.',
      );
      return;
    }
    if (ownerPassword.length < 12) {
      log.warn(
        'KEYNV_BOOTSTRAP_OWNER_PASSWORD is shorter than 12 characters — ' +
          'owner not created. Set a longer password and restart.',
      );
      return;
    }

    log.info('initializing fresh deployment — creating owner + org');
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
  } finally {
    raw.close();
  }
}
