import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crypto } from '@keynv/core';
import { createApp } from '../app.js';
import { hashPassword } from '../auth/password.js';
import { openDb } from '../db/index.js';
import { schema } from '../db/index.js';
import { newOrgId, newUserId } from '../lib/id.js';

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
    await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/dev/k/rotate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ new_value: 'v2' }),
      },
    );
    const getRes = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/dev/k`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    const got = (await getRes.json()) as { value: string; version: number };
    expect(got.value).toBe('v2');
    expect(got.version).toBe(2);
  });
});
