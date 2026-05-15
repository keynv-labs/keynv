/**
 * Run-once bootstrap: creates the master KEK file (if missing) and the
 * initial Owner account. Idempotent guards prevent accidental re-init.
 *
 * Password input ranking (audit finding H4 — argv leaks via /proc):
 *   1. KEYNV_BOOTSTRAP_OWNER_PASSWORD env var (recommended for automation)
 *   2. stdin (interactive, hidden — recommended for humans)
 *   3. --owner-password argv (refused unless --unsafe-allow-argv is set)
 *
 * Usage:
 *   KEYNV_BOOTSTRAP_OWNER_PASSWORD='...' pnpm --filter @keynv/server bootstrap \
 *     --owner-email lead@team.com --org-name acme
 */

import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { hashPassword } from './auth/password.js';
import { openDb } from './db/index.js';
import { schema } from './db/index.js';
import { loadOrCreateKek } from './kek/load.js';
import { loadEnv } from './lib/env.js';
import { newOrgId, newUserId } from './lib/id.js';

async function readHiddenStdin(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    // Piped input — read all stdin, trim trailing newline.
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
    }
    return Buffer.concat(chunks).toString('utf8').replace(/\n$/, '');
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise<string>((resolve) => {
    let buf = '';
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\n' || ch === '\r' || ch === '') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(buf);
          return;
        }
        if (ch === '') process.exit(130);
        if (ch === '' || ch === '\b') {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'owner-email': { type: 'string' },
      'owner-password': { type: 'string' },
      'org-name': { type: 'string' },
      'unsafe-allow-argv': { type: 'boolean', default: false },
    },
  });

  const ownerEmail = values['owner-email'];
  const orgName = values['org-name'] ?? 'default';
  if (!ownerEmail) {
    console.error('bootstrap: --owner-email is required');
    process.exit(2);
  }

  const argvPassword = values['owner-password'];
  const envPassword = process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'];
  const legacyEnvPassword = process.env['KEYNV_BOOTSTRAP_PASSWORD'];

  let ownerPassword: string;
  if (envPassword) {
    ownerPassword = envPassword;
  } else if (legacyEnvPassword) {
    console.warn(
      'bootstrap: KEYNV_BOOTSTRAP_PASSWORD is deprecated; use KEYNV_BOOTSTRAP_OWNER_PASSWORD.',
    );
    ownerPassword = legacyEnvPassword;
  } else if (argvPassword) {
    if (!values['unsafe-allow-argv']) {
      console.error(
        'bootstrap: refusing --owner-password on argv (visible via /proc/<pid>/cmdline). ' +
          'Use KEYNV_BOOTSTRAP_OWNER_PASSWORD env var or pipe the password on stdin. ' +
          'Pass --unsafe-allow-argv to override.',
      );
      process.exit(2);
    }
    ownerPassword = argvPassword;
  } else {
    ownerPassword = await readHiddenStdin('owner password: ');
  }

  if (ownerPassword.length < 12) {
    console.error('bootstrap: owner password must be at least 12 characters');
    process.exit(2);
  }

  const env = loadEnv();
  if (existsSync(env.KEYNV_DB_PATH)) {
    console.error(
      `bootstrap: refusing to overwrite ${env.KEYNV_DB_PATH}; remove it manually first.`,
    );
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

  console.log(`bootstrap: created org "${orgName}" (id=${orgId})`);
  console.log(`bootstrap: owner ${ownerEmail} (id=${userId})`);
  console.log(`bootstrap: master key file at ${env.KEYNV_MASTER_KEY_FILE}`);
  console.log('bootstrap: store the master key file safely; loss bricks the deployment.');
  // Reduce password lifetime in process memory; not a guarantee but
  // helps if the process is then re-used (it isn't, but defensive).
  ownerPassword = '';
  if (process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD']) {
    delete process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'];
  }
  if (process.env['KEYNV_BOOTSTRAP_PASSWORD']) delete process.env['KEYNV_BOOTSTRAP_PASSWORD'];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
