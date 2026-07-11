import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { maybeAutoBootstrap } from './auto-bootstrap.js';
import { openDb, schema } from './db/index.js';
import type { ServerEnvT } from './lib/env.js';

const BOOTSTRAP_VARS = [
  'KEYNV_BOOTSTRAP_OWNER_EMAIL',
  'KEYNV_BOOTSTRAP_OWNER_PASSWORD',
  'KEYNV_BOOTSTRAP_ORG_NAME',
] as const;

function makeEnv(dir: string): ServerEnvT {
  return {
    KEYNV_DB_PATH: join(dir, 'keynv.db'),
    KEYNV_MASTER_KEY_FILE: join(dir, 'master.key'),
    KEYNV_JWT_SECRET: 'x'.repeat(32),
    KEYNV_JWT_SECRET_FILE: join(dir, 'jwt.secret'),
    KEYNV_PORT: 8080,
    KEYNV_ACCESS_TOKEN_TTL_S: 900,
    KEYNV_REFRESH_TOKEN_TTL_S: 604800,
    KEYNV_LOG_LEVEL: 'fatal',
    KEYNV_RATE_LIMIT_PER_MINUTE: 0,
    KEYNV_PUBLIC_REGISTRATION: false,
    KEYNV_REGISTER_RATE_LIMIT_PER_MINUTE: 0,
    KEYNV_BROWSER_POLL_RATE_LIMIT_PER_MINUTE: 0,
    KEYNV_ARGON2_MEMORY_KIB: 19_456,
    KEYNV_ARGON2_TIME_COST: 2,
    KEYNV_ARGON2_PARALLELISM: 1,
    KEYNV_TRUSTED_PROXY_COUNT: 1,
  };
}

describe('maybeAutoBootstrap', () => {
  let dir: string;
  const savedVars = new Map<string, string | undefined>();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'keynv-autoboot-'));
    for (const k of BOOTSTRAP_VARS) {
      savedVars.set(k, process.env[k]);
      delete process.env[k];
    }
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    for (const k of BOOTSTRAP_VARS) {
      const v = savedVars.get(k);
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    savedVars.clear();
  });

  it('creates the owner even when master.key already exists, as long as no org exists yet', async () => {
    // Owner creation keys off org existence, not the master-key file, so an
    // operator can deploy first (key generated) and add the bootstrap vars
    // on a later restart.
    const env = makeEnv(dir);
    writeFileSync(env.KEYNV_MASTER_KEY_FILE, Buffer.alloc(32, 0xab));
    process.env['KEYNV_BOOTSTRAP_OWNER_EMAIL'] = 'owner@team.com';
    process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'] = 'long-enough-password';
    await maybeAutoBootstrap(env);
    const { db, raw } = openDb({ path: env.KEYNV_DB_PATH, migrate: false });
    try {
      const users = await db.select().from(schema.users);
      expect(users).toHaveLength(1);
      expect(users[0]?.email).toBe('owner@team.com');
    } finally {
      raw.close();
    }
  });

  it('generates the master key and boots ownerless when no bootstrap vars are set', async () => {
    const env = makeEnv(dir);
    await maybeAutoBootstrap(env);
    // The master key IS created so the server can start (no crash-loop)...
    expect(existsSync(env.KEYNV_MASTER_KEY_FILE)).toBe(true);
    // ...but no org/owner is created without the bootstrap vars.
    const { db, raw } = openDb({ path: env.KEYNV_DB_PATH, migrate: false });
    try {
      expect(await db.select().from(schema.orgs)).toHaveLength(0);
      expect(await db.select().from(schema.users)).toHaveLength(0);
    } finally {
      raw.close();
    }
  });

  it('warns (never throws) and skips owner creation when the bootstrap password is too short', async () => {
    const env = makeEnv(dir);
    process.env['KEYNV_BOOTSTRAP_OWNER_EMAIL'] = 'owner@team.com';
    process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'] = 'short';
    // A misconfigured password must not crash-loop the server.
    await expect(maybeAutoBootstrap(env)).resolves.toBeUndefined();
    expect(existsSync(env.KEYNV_MASTER_KEY_FILE)).toBe(true);
    const { db, raw } = openDb({ path: env.KEYNV_DB_PATH, migrate: false });
    try {
      expect(await db.select().from(schema.users)).toHaveLength(0);
    } finally {
      raw.close();
    }
  });

  it('creates master.key, org, and owner when env vars are set and master.key is missing', async () => {
    const env = makeEnv(dir);
    process.env['KEYNV_BOOTSTRAP_OWNER_EMAIL'] = 'owner@team.com';
    process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'] = 'this-is-long-enough';
    process.env['KEYNV_BOOTSTRAP_ORG_NAME'] = 'acme';

    await maybeAutoBootstrap(env);

    expect(existsSync(env.KEYNV_MASTER_KEY_FILE)).toBe(true);
    expect(existsSync(env.KEYNV_DB_PATH)).toBe(true);

    const { db, raw } = openDb({ path: env.KEYNV_DB_PATH, migrate: false });
    try {
      const orgs = await db.select().from(schema.orgs);
      expect(orgs).toHaveLength(1);
      expect(orgs[0]?.name).toBe('acme');

      const users = await db.select().from(schema.users);
      expect(users).toHaveLength(1);
      expect(users[0]?.email).toBe('owner@team.com');
      expect(users[0]?.org_role).toBe('owner');
      // Argon2id-hashed, never plaintext.
      expect(users[0]?.password_hash).toMatch(/^\$argon2id\$/);
      expect(users[0]?.password_hash).not.toContain('this-is-long-enough');
    } finally {
      raw.close();
    }
  });

  it('clears the bootstrap password from process.env after a successful run', async () => {
    const env = makeEnv(dir);
    process.env['KEYNV_BOOTSTRAP_OWNER_EMAIL'] = 'owner@team.com';
    process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'] = 'this-is-long-enough';
    await maybeAutoBootstrap(env);
    expect(process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD']).toBeUndefined();
    // Email is benign, fine to leave.
    expect(process.env['KEYNV_BOOTSTRAP_OWNER_EMAIL']).toBe('owner@team.com');
  });

  it('skips owner creation if an org already exists (idempotency)', async () => {
    const env = makeEnv(dir);
    // Pre-seed: open DB + insert an org row, but leave master.key missing.
    const { db, raw } = openDb({ path: env.KEYNV_DB_PATH, migrate: true });
    await db.insert(schema.orgs).values({ id: 'org_existing', name: 'preexisting' });
    raw.close();
    expect(existsSync(env.KEYNV_MASTER_KEY_FILE)).toBe(false);

    process.env['KEYNV_BOOTSTRAP_OWNER_EMAIL'] = 'owner@team.com';
    process.env['KEYNV_BOOTSTRAP_OWNER_PASSWORD'] = 'this-is-long-enough';
    await maybeAutoBootstrap(env);

    // master.key still gets created — that's required for the server to start.
    expect(existsSync(env.KEYNV_MASTER_KEY_FILE)).toBe(true);

    const { db: db2, raw: raw2 } = openDb({ path: env.KEYNV_DB_PATH, migrate: false });
    try {
      const orgs = await db2.select().from(schema.orgs);
      expect(orgs).toHaveLength(1);
      expect(orgs[0]?.name).toBe('preexisting');
      const users = await db2.select().from(schema.users);
      expect(users).toHaveLength(0);
    } finally {
      raw2.close();
    }
  });
});
