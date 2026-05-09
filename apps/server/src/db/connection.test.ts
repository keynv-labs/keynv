import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './index.js';
import * as schema from './schema.js';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function makeDb(): { db: Db } {
  const { db, raw } = openDb({ path: ':memory:', migrate: true });
  cleanup = () => raw.close();
  return { db };
}

describe('openDb', () => {
  it('runs migrations and creates every Phase 1 table', () => {
    const { db } = makeDb();
    const tables = db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    ) as Array<{ name: string }>;
    const names = new Set(tables.map((t) => t.name));
    for (const expected of [
      'audit',
      'auth_refresh_tokens',
      'environments',
      'memberships',
      'orgs',
      'projects',
      'schema_migrations',
      'secrets',
      'users',
    ]) {
      expect(names.has(expected), `missing table: ${expected}`).toBe(true);
    }
  });

  it('is idempotent on re-open (migrations already applied)', () => {
    const first = openDb({ path: ':memory:', migrate: true });
    expect(() => first.raw.exec('SELECT 1 FROM schema_migrations')).not.toThrow();
    first.raw.close();

    const second = openDb({ path: ':memory:', migrate: true });
    expect(() => second.raw.exec('SELECT 1 FROM schema_migrations')).not.toThrow();
    second.raw.close();
  });

  it('inserts an org and reads it back via Drizzle', async () => {
    const { db } = makeDb();
    await db.insert(schema.orgs).values({ id: 'org_1', name: 'demo' });
    const rows = await db.select().from(schema.orgs);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('demo');
    expect(rows[0]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('enforces email-per-org uniqueness', async () => {
    const { db } = makeDb();
    await db.insert(schema.orgs).values({ id: 'org_1', name: 'demo' });
    await db.insert(schema.users).values({
      id: 'u_1',
      org_id: 'org_1',
      email: 'a@team.com',
      password_hash: 'argon2id$...',
      org_role: 'owner',
    });
    await expect(
      db.insert(schema.users).values({
        id: 'u_2',
        org_id: 'org_1',
        email: 'a@team.com',
        password_hash: 'argon2id$...',
        org_role: 'developer',
      }),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('cascades user deletion to memberships', async () => {
    const { db } = makeDb();
    await db.insert(schema.orgs).values({ id: 'org_1', name: 'demo' });
    await db.insert(schema.users).values({
      id: 'u_1',
      org_id: 'org_1',
      email: 'a@team.com',
      password_hash: 'h',
      org_role: 'developer',
    });
    await db.insert(schema.projects).values({
      id: 'p_1',
      org_id: 'org_1',
      name: 'demo',
      dek_wrapped: Buffer.from([1, 2, 3]),
      dek_nonce: Buffer.from([4, 5, 6]),
    });
    await db.insert(schema.memberships).values({
      user_id: 'u_1',
      project_id: 'p_1',
      role: 'lead',
    });
    await db.delete(schema.users).where(sql`id = 'u_1'`);
    const remaining = await db.select().from(schema.memberships);
    expect(remaining).toHaveLength(0);
  });
});
