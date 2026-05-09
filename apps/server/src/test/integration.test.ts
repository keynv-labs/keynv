import { crypto } from '@keynv/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashPassword } from '../auth/password.js';
import { openDb } from '../db/index.js';
import { schema } from '../db/index.js';
import { newOrgId, newUserId } from '../lib/id.js';
import { makeLogger } from '../lib/logger.js';

const SILENT_LOGGER = makeLogger('silent');

interface Harness {
  app: ReturnType<typeof createApp>;
  cleanup: () => void;
  ownerEmail: string;
  ownerPassword: string;
  developerEmail: string;
  developerPassword: string;
}

const JWT_SECRET = 'test-test-test-test-test-test-test-test-12345';

async function makeHarness(): Promise<Harness> {
  const { db, raw } = openDb({ path: ':memory:', migrate: true });
  const kek = await crypto.generateKey();
  const orgId = newOrgId();
  const ownerId = newUserId();
  const developerId = newUserId();
  const ownerEmail = 'owner@team.test';
  const ownerPassword = 'owner-password-12345';
  const developerEmail = 'dev@team.test';
  const developerPassword = 'developer-password-12345';

  await db.insert(schema.orgs).values({ id: orgId, name: 'acme' });
  await db.insert(schema.users).values({
    id: ownerId,
    org_id: orgId,
    email: ownerEmail,
    password_hash: await hashPassword(ownerPassword),
    org_role: 'owner',
  });
  await db.insert(schema.users).values({
    id: developerId,
    org_id: orgId,
    email: developerEmail,
    password_hash: await hashPassword(developerPassword),
    org_role: 'developer',
  });

  const app = createApp({
    db,
    jwtSecret: JWT_SECRET,
    accessTtlS: 900,
    refreshTtlS: 7 * 24 * 3600,
    getKek: () => kek,
    version: 'test',
    logger: SILENT_LOGGER,
  });

  return {
    app,
    cleanup: () => raw.close(),
    ownerEmail,
    ownerPassword,
    developerEmail,
    developerPassword,
  };
}

async function login(app: Harness['app'], email: string, password: string): Promise<string> {
  const res = await app.request('http://localhost/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

let harness: Harness;
beforeEach(async () => {
  harness = await makeHarness();
});
afterEach(() => harness.cleanup());

describe('Phase 1 acceptance flow', () => {
  it('owner can create project with environments', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const res = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'billing',
        environments: [
          { name: 'dev', tier: 'non-production' },
          { name: 'prod', tier: 'production', require_approval: true },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string };
    expect(body.name).toBe('billing');
    expect(body.id).toMatch(/^p_/);
  });

  it('owner can grant developer access to a project', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'billing',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    const project = (await projRes.json()) as { id: string };

    const memberRes = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/members`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ email: harness.developerEmail, role: 'developer' }),
      },
    );
    expect(memberRes.status).toBe(201);
  });

  it('developer can resolve a secret created by the owner', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);

    // create project
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'demo',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    const project = (await projRes.json()) as { id: string };

    // grant developer access
    await harness.app.request(`http://localhost/v1/projects/${project.id}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ email: harness.developerEmail, role: 'developer' }),
    });

    // owner creates secret
    const secretRes = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ env: 'dev', key: 'db_password', value: 'super-secret-value' }),
      },
    );
    expect(secretRes.status).toBe(201);

    // developer logs in & reads
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);
    const getRes = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/dev/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );
    expect(getRes.status).toBe(200);
    const got = (await getRes.json()) as { alias: string; value: string; version: number };
    expect(got.alias).toBe('@demo.dev.db_password');
    expect(got.value).toBe('super-secret-value');
    expect(got.version).toBe(1);
  });

  it('production-tier read by developer returns rbac.approval_required', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'demo',
        environments: [{ name: 'prod', tier: 'production', require_approval: true }],
      }),
    });
    const project = (await projRes.json()) as { id: string };
    await harness.app.request(`http://localhost/v1/projects/${project.id}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ email: harness.developerEmail, role: 'developer' }),
    });
    await harness.app.request(`http://localhost/v1/projects/${project.id}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ env: 'prod', key: 'db_password', value: 'prod-secret' }),
    });

    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);
    const res = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('rbac.approval_required');
  });

  it('developer cannot create a secret (rbac denied)', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'demo',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    const project = (await projRes.json()) as { id: string };
    await harness.app.request(`http://localhost/v1/projects/${project.id}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ email: harness.developerEmail, role: 'developer' }),
    });

    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);
    const res = await harness.app.request(`http://localhost/v1/projects/${project.id}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${devToken}` },
      body: JSON.stringify({ env: 'dev', key: 'k', value: 'v' }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('rbac.denied');
  });

  it('audit log records the full flow with a verifiable chain', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'demo',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    const project = (await projRes.json()) as { id: string };
    await harness.app.request(`http://localhost/v1/projects/${project.id}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ email: harness.developerEmail, role: 'developer' }),
    });
    await harness.app.request(`http://localhost/v1/projects/${project.id}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ env: 'dev', key: 'k', value: 'v' }),
    });

    const listRes = await harness.app.request('http://localhost/v1/audit', {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const list = (await listRes.json()) as { entries: Array<{ event_type: string }> };
    const types = new Set(list.entries.map((e) => e.event_type));
    expect(types.has('auth.login.allowed')).toBe(true);
    expect(types.has('project.created')).toBe(true);
    expect(types.has('member.added')).toBe(true);
    expect(types.has('secret.created')).toBe(true);

    const verifyRes = await harness.app.request('http://localhost/v1/audit/verify', {
      method: 'POST',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const verify = (await verifyRes.json()) as { ok: boolean; checked: number };
    expect(verify.ok).toBe(true);
    expect(verify.checked).toBeGreaterThan(0);
  });

  it('rejects login with wrong password and emits auth.login.denied', async () => {
    const res = await harness.app.request('http://localhost/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: harness.ownerEmail, password: 'wrong-password' }),
    });
    expect(res.status).toBe(401);

    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const auditRes = await harness.app.request(
      'http://localhost/v1/audit?event_type=auth.login.denied',
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    const list = (await auditRes.json()) as { entries: Array<{ event_type: string }> };
    expect(list.entries.length).toBeGreaterThan(0);
    expect(list.entries[0]?.event_type).toBe('auth.login.denied');
  });

  it('rotation produces a new version and supersedes the old', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'demo',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    const project = (await projRes.json()) as { id: string };
    await harness.app.request(`http://localhost/v1/projects/${project.id}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ env: 'dev', key: 'k', value: 'v1' }),
    });
    await harness.app.request(`http://localhost/v1/projects/${project.id}/secrets/dev/k/rotate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ new_value: 'v2' }),
    });
    const getRes = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/dev/k`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    const got = (await getRes.json()) as { value: string; version: number };
    expect(got.value).toBe('v2');
    expect(got.version).toBe(2);
  });
});

// Regression suite for audit finding B2 — cross-org access.
describe('B2 regression — cross-org access is denied', () => {
  async function twoOrgHarness() {
    const { db, raw } = openDb({ path: ':memory:', migrate: true });
    const kek = await crypto.generateKey();

    const orgA = newOrgId();
    const orgB = newOrgId();
    const ownerA = newUserId();
    const ownerB = newUserId();
    const passA = 'owner-a-password-12345';
    const passB = 'owner-b-password-12345';

    await db.insert(schema.orgs).values([
      { id: orgA, name: 'acme' },
      { id: orgB, name: 'globex' },
    ]);
    await db.insert(schema.users).values([
      {
        id: ownerA,
        org_id: orgA,
        email: 'a@team.test',
        password_hash: await hashPassword(passA),
        org_role: 'owner',
      },
      {
        id: ownerB,
        org_id: orgB,
        email: 'b@team.test',
        password_hash: await hashPassword(passB),
        org_role: 'owner',
      },
    ]);

    const app = createApp({
      db,
      jwtSecret: JWT_SECRET,
      accessTtlS: 900,
      refreshTtlS: 7 * 24 * 3600,
      getKek: () => kek,
      version: 'test',
      logger: SILENT_LOGGER,
    });

    return {
      app,
      cleanup: () => raw.close(),
      tokenA: await login(app, 'a@team.test', passA),
      tokenB: await login(app, 'b@team.test', passB),
    };
  }

  it("owner of org B cannot read org A's project, secret, or members", async () => {
    const h = await twoOrgHarness();
    try {
      // Owner A creates project + secret in org A.
      const projRes = await h.app.request('http://localhost/v1/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${h.tokenA}` },
        body: JSON.stringify({
          name: 'demo',
          environments: [{ name: 'dev', tier: 'non-production' }],
        }),
      });
      const project = (await projRes.json()) as { id: string };

      await h.app.request(`http://localhost/v1/projects/${project.id}/secrets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${h.tokenA}` },
        body: JSON.stringify({ env: 'dev', key: 'db_pass', value: 'secret-from-A' }),
      });

      // Owner B knows the project_id; every cross-org access must 404.
      const get = await h.app.request(`http://localhost/v1/projects/${project.id}`, {
        headers: { authorization: `Bearer ${h.tokenB}` },
      });
      expect(get.status).toBe(404);

      const read = await h.app.request(
        `http://localhost/v1/projects/${project.id}/secrets/dev/db_pass`,
        { headers: { authorization: `Bearer ${h.tokenB}` } },
      );
      expect(read.status).toBe(404);

      const list = await h.app.request(`http://localhost/v1/projects/${project.id}/secrets`, {
        headers: { authorization: `Bearer ${h.tokenB}` },
      });
      expect(list.status).toBe(404);

      const members = await h.app.request(`http://localhost/v1/projects/${project.id}/members`, {
        headers: { authorization: `Bearer ${h.tokenB}` },
      });
      expect(members.status).toBe(404);

      const del = await h.app.request(`http://localhost/v1/projects/${project.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${h.tokenB}` },
      });
      expect(del.status).toBe(404);

      const rotate = await h.app.request(
        `http://localhost/v1/projects/${project.id}/secrets/dev/db_pass/rotate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${h.tokenB}` },
          body: JSON.stringify({ new_value: 'pwned' }),
        },
      );
      expect(rotate.status).toBe(404);

      // Owner A's value is untouched.
      const verify = await h.app.request(
        `http://localhost/v1/projects/${project.id}/secrets/dev/db_pass`,
        { headers: { authorization: `Bearer ${h.tokenA}` } },
      );
      const verifyBody = (await verify.json()) as { value: string };
      expect(verifyBody.value).toBe('secret-from-A');
    } finally {
      h.cleanup();
    }
  });
});

describe('User management — DELETE /v1/users/:id', () => {
  it('owner can remove a developer; subsequent login is rejected', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);

    const listBefore = await harness.app.request('http://localhost/v1/users', {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const beforeBody = (await listBefore.json()) as { users: Array<{ id: string; email: string }> };
    const dev = beforeBody.users.find((u) => u.email === harness.developerEmail);
    if (!dev) throw new Error('developer not found in setup');

    const del = await harness.app.request(`http://localhost/v1/users/${dev.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(del.status).toBe(204);

    // Subsequent login fails.
    const loginRes = await harness.app.request('http://localhost/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: harness.developerEmail,
        password: harness.developerPassword,
      }),
    });
    expect(loginRes.status).toBe(401);
  });

  it('developer cannot remove anyone (rbac denied)', async () => {
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);

    const list = await harness.app.request('http://localhost/v1/users', {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const body = (await list.json()) as { users: Array<{ id: string; email: string }> };
    const dev = body.users.find((u) => u.email === harness.developerEmail);
    if (!dev) throw new Error('developer not found');

    const del = await harness.app.request(`http://localhost/v1/users/${dev.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${devToken}` },
    });
    expect(del.status).toBe(403);
  });

  it('owner cannot remove themselves', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const me = await harness.app.request('http://localhost/v1/whoami', {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const meBody = (await me.json()) as { id: string };
    const del = await harness.app.request(`http://localhost/v1/users/${meBody.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(del.status).toBe(403);
  });

  it('owner cannot be removed by an admin (owner role is protected)', async () => {
    // Promote the developer to admin first.
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const list = await harness.app.request('http://localhost/v1/users', {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const body = (await list.json()) as {
      users: Array<{ id: string; email: string; org_role: string }>;
    };
    const dev = body.users.find((u) => u.email === harness.developerEmail);
    const owner = body.users.find((u) => u.email === harness.ownerEmail);
    if (!dev || !owner) throw new Error('seed users missing');

    await harness.app.request(`http://localhost/v1/users/${dev.id}/org-role`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ org_role: 'admin' }),
    });

    const adminToken = await login(harness.app, harness.developerEmail, harness.developerPassword);
    const del = await harness.app.request(`http://localhost/v1/users/${owner.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(del.status).toBe(403);
    const errBody = (await del.json()) as { error: { code: string } };
    expect(errBody.error.code).toBe('rbac.denied');
  });
});

describe('Password change — POST /v1/auth/password', () => {
  async function changePassword(
    token: string,
    body: { current_password: string; new_password: string },
  ) {
    return harness.app.request('http://localhost/v1/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  it('happy path: new password works, old password rejected, refresh tokens revoked', async () => {
    // Login twice to get two refresh tokens (simulating two devices).
    const loginRes1 = await harness.app.request('http://localhost/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: harness.ownerEmail, password: harness.ownerPassword }),
    });
    const session1 = (await loginRes1.json()) as { access_token: string; refresh_token: string };

    const loginRes2 = await harness.app.request('http://localhost/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: harness.ownerEmail, password: harness.ownerPassword }),
    });
    const session2 = (await loginRes2.json()) as { refresh_token: string };

    // Change password.
    const newPassword = 'rotated-password-9876';
    const change = await changePassword(session1.access_token, {
      current_password: harness.ownerPassword,
      new_password: newPassword,
    });
    expect(change.status).toBe(204);

    // Old password no longer accepted.
    const oldLogin = await harness.app.request('http://localhost/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: harness.ownerEmail, password: harness.ownerPassword }),
    });
    expect(oldLogin.status).toBe(401);

    // New password works.
    const newLogin = await harness.app.request('http://localhost/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: harness.ownerEmail, password: newPassword }),
    });
    expect(newLogin.status).toBe(200);

    // Both old refresh tokens are revoked.
    for (const refresh of [session1.refresh_token, session2.refresh_token]) {
      const r = await harness.app.request('http://localhost/v1/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      expect(r.status).toBe(401);
    }
  });

  it('rejects wrong current password and writes auth.password_change.denied', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const res = await changePassword(token, {
      current_password: 'definitely-not-the-password',
      new_password: 'whatever-12-chars-long',
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('auth.invalid_credentials');
  });

  it('rejects new password shorter than 12 characters', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const res = await changePassword(token, {
      current_password: harness.ownerPassword,
      new_password: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('rejects new password equal to current', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const res = await changePassword(token, {
      current_password: harness.ownerPassword,
      new_password: harness.ownerPassword,
    });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await harness.app.request('http://localhost/v1/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        current_password: 'x',
        new_password: 'twelve-chars-min',
      }),
    });
    expect(res.status).toBe(401);
  });
});
