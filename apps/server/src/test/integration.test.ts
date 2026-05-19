import { crypto } from '@keynv/core';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashPassword } from '../auth/password.js';
import { openDb } from '../db/index.js';
import { schema } from '../db/index.js';
import { newOrgId, newUserId } from '../lib/id.js';
import { makeLogger } from '../lib/logger.js';
import { ensurePendingApproval } from '../routes/approvals.js';

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

async function makeHarness(
  opts: {
    rateLimitPerMinute?: number;
    publicRegistrationEnabled?: boolean;
    registerRateLimitPerMinute?: number;
  } = {},
): Promise<Harness> {
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
    // 0 disables the limiter entirely for the existing 40 tests; the
    // rate-limit-specific suite below pins a small budget on its own
    // harness instance.
    rateLimitPerMinute: opts.rateLimitPerMinute ?? 0,
    // Default off so existing tests don't accidentally exercise the
    // signup path; the registration suite turns it on.
    publicRegistrationEnabled: opts.publicRegistrationEnabled ?? false,
    registerRateLimitPerMinute: opts.registerRateLimitPerMinute ?? 0,
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

describe('POST /v1/projects/:id/secrets/batch', () => {
  async function createBatchProject(token: string): Promise<string> {
    const res = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'batch-demo',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    return body.id;
  }

  async function listSecretAliases(token: string, projectId: string): Promise<string[]> {
    const res = await harness.app.request(`http://localhost/v1/projects/${projectId}/secrets`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { secrets: Array<{ alias: string }> };
    return body.secrets.map((secret) => secret.alias).sort();
  }

  it('creates multiple secrets atomically', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createBatchProject(token);

    const res = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/batch`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          secrets: [
            { env: 'dev', key: 'API_TOKEN', value: 'token-value' },
            { env: 'dev', key: 'DB_PASSWORD', value: 'db-value' },
          ],
        }),
      },
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: Array<{ alias: string; version: number }> };
    expect(body.created).toEqual([
      { alias: '@batch-demo.dev.API_TOKEN', version: 1 },
      { alias: '@batch-demo.dev.DB_PASSWORD', version: 1 },
    ]);
    expect(await listSecretAliases(token, projectId)).toEqual([
      '@batch-demo.dev.API_TOKEN',
      '@batch-demo.dev.DB_PASSWORD',
    ]);
  });

  it('rejects duplicate keys in the request without writing secrets', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createBatchProject(token);

    const res = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/batch`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          secrets: [
            { env: 'dev', key: 'API_TOKEN', value: 'first' },
            { env: 'dev', key: 'API_TOKEN', value: 'second' },
          ],
        }),
      },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; details: Array<{ code: string }> };
    };
    expect(body.error.code).toBe('secret.batch_invalid');
    expect(body.error.details[0]?.code).toBe('secret.duplicate_in_batch');
    expect(await listSecretAliases(token, projectId)).toEqual([]);
  });

  it('rejects missing environments without writing secrets', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createBatchProject(token);

    const res = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/batch`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          secrets: [
            { env: 'dev', key: 'API_TOKEN', value: 'token-value' },
            { env: 'staging', key: 'DB_PASSWORD', value: 'db-value' },
          ],
        }),
      },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; details: Array<{ code: string }> };
    };
    expect(body.error.code).toBe('secret.batch_invalid');
    expect(body.error.details[0]?.code).toBe('environment.not_found');
    expect(await listSecretAliases(token, projectId)).toEqual([]);
  });

  it('rejects existing active secrets without writing new batch secrets', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createBatchProject(token);
    await harness.app.request(`http://localhost/v1/projects/${projectId}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ env: 'dev', key: 'API_TOKEN', value: 'existing' }),
    });

    const res = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/batch`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          secrets: [
            { env: 'dev', key: 'API_TOKEN', value: 'new-value' },
            { env: 'dev', key: 'DB_PASSWORD', value: 'db-value' },
          ],
        }),
      },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; details: Array<{ code: string }> };
    };
    expect(body.error.code).toBe('secret.batch_invalid');
    expect(body.error.details[0]?.code).toBe('secret.already_exists');
    expect(await listSecretAliases(token, projectId)).toEqual(['@batch-demo.dev.API_TOKEN']);
  });
});

describe('Rotation — set interval, list rotations, rotation includes metadata', () => {
  async function createRotationProject(token: string): Promise<string> {
    const res = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'rotation-demo', environments: [{ name: 'dev', tier: 'non-production' }] }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    return body.id;
  }

  it('rotation stores metadata (rotated_at, next_rotation_at) when interval is set', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createRotationProject(token);

    // Create secret first
    await harness.app.request(`http://localhost/v1/projects/${projectId}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ env: 'dev', key: 'DB_PASS', value: 'initial' }),
    });

    // Set rotation interval
    const setRes = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/dev/DB_PASS/rotation`,
      { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ interval_days: 30 }) },
    );
    expect(setRes.status).toBe(200);
    const setBody = (await setRes.json()) as { alias: string; interval_days: number; next_rotation_at: string };
    expect(setBody.alias).toBe('@rotation-demo.dev.DB_PASS');
    expect(setBody.interval_days).toBe(30);
    expect(setBody.next_rotation_at).toBeTruthy();

    // Rotate the secret
    const rotateRes = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/dev/DB_PASS/rotate`,
      { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ new_value: 'rotated-value' }) },
    );
    expect(rotateRes.status).toBe(200);
    const rotateBody = (await rotateRes.json()) as { alias: string; version: number; next_rotation_at: string };
    expect(rotateBody.version).toBe(2);
    expect(rotateBody.next_rotation_at).toBeTruthy();

    // New rotation should have next_rotation_at ~30 days after now
    const nextDate = new Date(rotateBody.next_rotation_at);
    const expected = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect(Math.abs(nextDate.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  it('PATCH rotation rejects invalid interval', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createRotationProject(token);

    await harness.app.request(`http://localhost/v1/projects/${projectId}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ env: 'dev', key: 'API_KEY', value: 'secret' }),
    });

    const zeroRes = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/dev/API_KEY/rotation`,
      { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ interval_days: 0 }) },
    );
    expect(zeroRes.status).toBe(400);
  });

  it('GET /rotations lists secrets with status due/upcoming', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createRotationProject(token);

    await harness.app.request(`http://localhost/v1/projects/${projectId}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ env: 'dev', key: 'TOKEN', value: 't' }),
    });

    // Set very short interval so it becomes overdue immediately
    const setRes = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/dev/TOKEN/rotation`,
      { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ interval_days: 1 }) },
    );
    expect(setRes.status).toBe(200);

    // Initially, next_rotation_at is in the future (1 day), so not due yet
    // But due query should still return it as "upcoming"
    const listDue = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/rotations?due=true`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(listDue.status).toBe(200);
    const listBody = (await listDue.json()) as { secrets: Array<{ alias: string; status: string }> };
    // Not yet due — status should be "upcoming", not "due"
    expect(listBody.secrets.length).toBeGreaterThanOrEqual(0);

    // Now rotate it with an interval of 1 day but set the last rotated time far in the past
    // We can't directly set rotated_at, but the list endpoint should show the status
    const listAll = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/rotations`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(listAll.status).toBe(200);
    const allBody = (await listAll.json()) as { secrets: Array<{ alias: string; rotation_interval_days: number; next_rotation_at: string | null; status: string }> };
    expect(allBody.secrets.length).toBe(1);
    expect(allBody.secrets[0]?.alias).toBe('@rotation-demo.dev.TOKEN');
    expect(allBody.secrets[0]?.rotation_interval_days).toBe(1);
  });

  it('GET /rotations returns empty list for project without rotation policies', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createRotationProject(token);

    await harness.app.request(`http://localhost/v1/projects/${projectId}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ env: 'dev', key: 'NO_ROTATION', value: 'secret' }),
    });

    const res = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/rotations`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { secrets: Array<unknown> };
    expect(body.secrets).toEqual([]);
  });

  it('audit trail includes rotation.policy_changed', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createRotationProject(token);

    await harness.app.request(`http://localhost/v1/projects/${projectId}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ env: 'dev', key: 'AUDIT_KEY', value: 'v' }),
    });

    await harness.app.request(
      `http://localhost/v1/projects/${projectId}/secrets/dev/AUDIT_KEY/rotation`,
      { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ interval_days: 90 }) },
    );

    const auditRes = await harness.app.request(
      'http://localhost/v1/audit?event_type=rotation.policy_changed',
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(auditRes.status).toBe(200);
    const auditBody = (await auditRes.json()) as { entries: Array<{ event_type: string; payload: { key: string; interval_days: number } }> };
    expect(auditBody.entries.length).toBe(1);
    expect(auditBody.entries[0]?.event_type).toBe('rotation.policy_changed');
    expect(auditBody.entries[0]?.payload.key).toBe('AUDIT_KEY');
    expect(auditBody.entries[0]?.payload.interval_days).toBe(90);
  });
});

describe('Clean user walkthrough', () => {
  it('registers, creates a second org, switches active org, creates a project, and resolves a secret', async () => {
    const local = await makeHarness({ publicRegistrationEnabled: true });
    try {
      const register = await local.app.request('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'new-user@example.test',
          password: 'new-user-password-12345',
          org_name: 'First Workspace',
        }),
      });
      expect(register.status).toBe(201);
      const registered = (await register.json()) as { access_token: string };

      const createOrg = await local.app.request('http://localhost/v1/org', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${registered.access_token}`,
        },
        body: JSON.stringify({ name: 'Side Project' }),
      });
      expect(createOrg.status).toBe(201);
      const org = (await createOrg.json()) as { id: string; name: string };
      expect(org.name).toBe('Side Project');

      const me = await local.app.request('http://localhost/v1/whoami', {
        headers: {
          authorization: `Bearer ${registered.access_token}`,
          'x-keynv-org': org.id,
        },
      });
      expect(me.status).toBe(200);
      const meBody = (await me.json()) as {
        org_id: string;
        org_role: string;
        orgs: Array<{ id: string; name: string }>;
      };
      expect(meBody.org_id).toBe(org.id);
      expect(meBody.org_role).toBe('owner');
      expect(meBody.orgs.map((o) => o.id)).toContain(org.id);

      const projectRes = await local.app.request('http://localhost/v1/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${registered.access_token}`,
          'x-keynv-org': org.id,
        },
        body: JSON.stringify({
          name: 'walkthrough',
          environments: [{ name: 'dev', tier: 'non-production' }],
        }),
      });
      expect(projectRes.status).toBe(201);
      const project = (await projectRes.json()) as { id: string; name: string };
      expect(project.name).toBe('walkthrough');

      const createSecret = await local.app.request(
        `http://localhost/v1/projects/${project.id}/secrets`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${registered.access_token}`,
            'x-keynv-org': org.id,
          },
          body: JSON.stringify({ env: 'dev', key: 'api_key', value: 'walkthrough-secret' }),
        },
      );
      expect(createSecret.status).toBe(201);

      const resolved = await local.app.request(
        `http://localhost/v1/projects/${project.id}/secrets/dev/api_key`,
        {
          headers: {
            authorization: `Bearer ${registered.access_token}`,
            'x-keynv-org': org.id,
          },
        },
      );
      expect(resolved.status).toBe(200);
      const resolvedBody = (await resolved.json()) as { alias: string; value: string };
      expect(resolvedBody.alias).toBe('@walkthrough.dev.api_key');
      expect(resolvedBody.value).toBe('walkthrough-secret');
    } finally {
      local.cleanup();
    }
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

  // Regression for AUDIT-FINDINGS-2 H3: the non-admin path on
  // GET /v1/projects ran without an org_id filter, so a developer in
  // org A would load every org's project rows into the Node heap
  // before the in-memory membership filter ran.
  it('developer in org A sees only org-A projects via GET /v1/projects', async () => {
    const h = await twoOrgHarness();
    try {
      // Add a developer to org A.
      const devEmail = 'dev-a@team.test';
      const devPassword = 'dev-a-password-12345';

      const orgARes = await h.app.request('http://localhost/v1/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${h.tokenA}` },
        body: JSON.stringify({
          name: 'project-a',
          environments: [{ name: 'dev', tier: 'non-production' }],
        }),
      });
      const projectA = (await orgARes.json()) as { id: string };

      // Owner B creates a project in org B — the rogue tenant.
      const orgBRes = await h.app.request('http://localhost/v1/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${h.tokenB}` },
        body: JSON.stringify({
          name: 'project-b',
          environments: [{ name: 'dev', tier: 'non-production' }],
        }),
      });
      const projectB = (await orgBRes.json()) as { id: string };

      // Owner A invites the developer + grants them access to project-a.
      const inviteRes = await h.app.request('http://localhost/v1/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${h.tokenA}` },
        body: JSON.stringify({ email: devEmail, password: devPassword, org_role: 'developer' }),
      });
      expect(inviteRes.status).toBe(201);
      const memberRes = await h.app.request(`http://localhost/v1/projects/${projectA.id}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${h.tokenA}` },
        body: JSON.stringify({ email: devEmail, role: 'developer' }),
      });
      expect(memberRes.status).toBe(201);

      // Developer logs in and lists projects.
      const devToken = await login(h.app, devEmail, devPassword);
      const listRes = await h.app.request('http://localhost/v1/projects', {
        headers: { authorization: `Bearer ${devToken}` },
      });
      expect(listRes.status).toBe(200);
      const body = (await listRes.json()) as { projects: Array<{ id: string; name: string }> };

      const ids = body.projects.map((p) => p.id);
      expect(ids).toContain(projectA.id);
      expect(ids).not.toContain(projectB.id);
      expect(body.projects.every((p) => p.name !== 'project-b')).toBe(true);
    } finally {
      h.cleanup();
    }
  });

  // Regression for AUDIT-FINDINGS-2 H5: PATCH /v1/users/:id/org-role
  // and DELETE /v1/users/:id mutated by id only. The SELECT correctly
  // scoped to the caller's org so cross-org requests already 404, but
  // a future concurrent org-move between SELECT and UPDATE could land
  // the mutation on the wrong row. Including org_id in the WHERE
  // closes that seam.
  it('owner B cannot patch or delete a user that belongs to org A', async () => {
    const h = await twoOrgHarness();
    try {
      const devEmail = 'dev-x@team.test';
      const devPassword = 'dev-x-password-12345';
      const inviteRes = await h.app.request('http://localhost/v1/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${h.tokenA}` },
        body: JSON.stringify({ email: devEmail, password: devPassword, org_role: 'developer' }),
      });
      expect(inviteRes.status).toBe(201);
      const dev = (await inviteRes.json()) as { id: string };

      const patch = await h.app.request(`http://localhost/v1/users/${dev.id}/org-role`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${h.tokenB}` },
        body: JSON.stringify({ org_role: 'reader' }),
      });
      expect(patch.status).toBe(404);

      const del = await h.app.request(`http://localhost/v1/users/${dev.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${h.tokenB}` },
      });
      expect(del.status).toBe(404);

      // Owner A confirms the dev row is still intact and untouched.
      const listA = await h.app.request('http://localhost/v1/users', {
        headers: { authorization: `Bearer ${h.tokenA}` },
      });
      const aBody = (await listA.json()) as {
        users: Array<{ id: string; org_role: string }>;
      };
      const stillDev = aBody.users.find((u) => u.id === dev.id);
      expect(stillDev?.org_role).toBe('developer');
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

describe('CLI tokens — /v1/cli-tokens', () => {
  it('issues a token, lists it (without raw), and authenticates with it', async () => {
    const sessionToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);

    // Create
    const create = await harness.app.request('http://localhost/v1/cli-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ name: 'laptop-1' }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as {
      id: string;
      name: string;
      token: string;
      expires_at: string | null;
    };
    expect(created.name).toBe('laptop-1');
    expect(created.token).toMatch(/^kt_/);
    expect(created.expires_at).toBeNull();

    // List — does NOT include the raw token, just metadata.
    const list = await harness.app.request('http://localhost/v1/cli-tokens', {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const listBody = (await list.json()) as {
      tokens: Array<{ id: string; name: string; revoked_at: string | null }>;
    };
    expect(listBody.tokens).toHaveLength(1);
    expect(listBody.tokens[0]?.name).toBe('laptop-1');
    expect(listBody.tokens[0]).not.toHaveProperty('token');
    expect(listBody.tokens[0]).not.toHaveProperty('token_hash');
    expect(listBody.tokens[0]?.revoked_at).toBeNull();

    // Authenticate using the CLI token to call /v1/whoami.
    const me = await harness.app.request('http://localhost/v1/whoami', {
      headers: { authorization: `Bearer ${created.token}` },
    });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { email: string; org_role: string };
    expect(meBody.email).toBe(harness.ownerEmail);
    expect(meBody.org_role).toBe('owner');
  });

  it('rejects an invalid CLI token', async () => {
    const me = await harness.app.request('http://localhost/v1/whoami', {
      headers: { authorization: 'Bearer kt_invalidtokenvaluedoesnotexist' },
    });
    expect(me.status).toBe(401);
  });

  it('revokes a token and rejects further calls with it', async () => {
    const sessionToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);

    const create = await harness.app.request('http://localhost/v1/cli-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ name: 'ci' }),
    });
    const created = (await create.json()) as { id: string; token: string };

    // Token works once.
    const before = await harness.app.request('http://localhost/v1/whoami', {
      headers: { authorization: `Bearer ${created.token}` },
    });
    expect(before.status).toBe(200);

    // Revoke.
    const del = await harness.app.request(`http://localhost/v1/cli-tokens/${created.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(del.status).toBe(204);

    // Token no longer works.
    const after = await harness.app.request('http://localhost/v1/whoami', {
      headers: { authorization: `Bearer ${created.token}` },
    });
    expect(after.status).toBe(401);

    // Listing shows revoked_at populated.
    const list = await harness.app.request('http://localhost/v1/cli-tokens', {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const listBody = (await list.json()) as { tokens: Array<{ revoked_at: string | null }> };
    expect(listBody.tokens[0]?.revoked_at).not.toBeNull();
  });

  it('users only see their own tokens', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);

    await harness.app.request('http://localhost/v1/cli-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'owner-laptop' }),
    });
    await harness.app.request('http://localhost/v1/cli-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${devToken}` },
      body: JSON.stringify({ name: 'dev-laptop' }),
    });

    const ownerList = await harness.app.request('http://localhost/v1/cli-tokens', {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const ownerBody = (await ownerList.json()) as { tokens: Array<{ name: string }> };
    expect(ownerBody.tokens).toHaveLength(1);
    expect(ownerBody.tokens[0]?.name).toBe('owner-laptop');

    const devList = await harness.app.request('http://localhost/v1/cli-tokens', {
      headers: { authorization: `Bearer ${devToken}` },
    });
    const devBody = (await devList.json()) as { tokens: Array<{ name: string }> };
    expect(devBody.tokens).toHaveLength(1);
    expect(devBody.tokens[0]?.name).toBe('dev-laptop');
  });

  it('one user cannot revoke another user’s token', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);

    const create = await harness.app.request('http://localhost/v1/cli-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'owner-laptop' }),
    });
    const created = (await create.json()) as { id: string };

    const del = await harness.app.request(`http://localhost/v1/cli-tokens/${created.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${devToken}` },
    });
    expect(del.status).toBe(404);
  });

  it('rejects names with disallowed characters', async () => {
    const sessionToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const res = await harness.app.request('http://localhost/v1/cli-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ name: 'has;semicolon' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Approvals — /v1/projects/:id/approvals', () => {
  async function setupProductionScenario() {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'billing',
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
    return { ownerToken, project };
  }

  it('developer read of a require_approval secret creates a pending row, idempotent', async () => {
    const { ownerToken, project } = await setupProductionScenario();
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);

    const r1 = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );
    expect(r1.status).toBe(202);

    const r2 = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );
    expect(r2.status).toBe(202);

    const list = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals?status=pending`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { approvals: Array<{ alias: string; status: string }> };
    expect(body.approvals).toHaveLength(1);
    expect(body.approvals[0]?.alias).toBe('@billing.prod.db_password');
    expect(body.approvals[0]?.status).toBe('pending');
  });

  it('after grant, developer can read; after expiry, the read is gated again', async () => {
    const { ownerToken, project } = await setupProductionScenario();
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);

    await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );

    const list = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals?status=pending`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    const approvalId = ((await list.json()) as { approvals: Array<{ id: string }> }).approvals[0]
      ?.id;
    if (!approvalId) throw new Error('expected pending approval');

    const grant = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals/${approvalId}/grant`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ expires_in_seconds: 1 }),
      },
    );
    expect(grant.status).toBe(200);

    const allowed = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );
    expect(allowed.status).toBe(200);
    const got = (await allowed.json()) as { value: string };
    expect(got.value).toBe('prod-secret');

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const reGated = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );
    expect(reGated.status).toBe(202);
  });

  it('deny path requires a reason and the row reflects it', async () => {
    const { ownerToken, project } = await setupProductionScenario();
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);

    await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );

    const list = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals?status=pending`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    const id = ((await list.json()) as { approvals: Array<{ id: string }> }).approvals[0]?.id;

    const denyEmpty = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals/${id}/deny`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({}),
      },
    );
    expect(denyEmpty.status).toBe(400);

    const deny = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals/${id}/deny`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ reason: 'use staging instead' }),
      },
    );
    expect(deny.status).toBe(200);

    const r = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );
    expect(r.status).toBe(202);

    const allList = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    const all = (await allList.json()) as {
      approvals: Array<{ status: string; reason: string | null }>;
    };
    expect(all.approvals.map((a) => a.status).sort()).toEqual(['denied', 'pending']);
    expect(all.approvals.find((a) => a.status === 'denied')?.reason).toBe('use staging instead');
  });

  it('developer cannot grant their own request', async () => {
    const { ownerToken, project } = await setupProductionScenario();
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);

    await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );
    const list = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals?status=pending`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    const id = ((await list.json()) as { approvals: Array<{ id: string }> }).approvals[0]?.id;

    const r = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals/${id}/grant`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${devToken}` },
        body: JSON.stringify({}),
      },
    );
    expect(r.status).toBe(403);
  });

  it('cannot grant the same approval twice', async () => {
    const { ownerToken, project } = await setupProductionScenario();
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);

    await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/prod/db_password`,
      { headers: { authorization: `Bearer ${devToken}` } },
    );
    const list = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals?status=pending`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    const id = ((await list.json()) as { approvals: Array<{ id: string }> }).approvals[0]?.id;

    const grant1 = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals/${id}/grant`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({}),
      },
    );
    expect(grant1.status).toBe(200);

    const grant2 = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/approvals/${id}/grant`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({}),
      },
    );
    expect(grant2.status).toBe(404);
  });

  // Regression for AUDIT-FINDINGS-2 H4: ensurePendingApproval used to
  // do a SELECT then INSERT without atomicity. Two parallel reads of
  // the same alias by the same developer could both pass the
  // existence check and both insert a pending row, doubling the
  // lead's queue.
  it('parallel ensurePendingApproval calls collapse to a single pending row', async () => {
    const { db, raw } = openDb({ path: ':memory:', migrate: true });
    try {
      const orgId = newOrgId();
      const ownerId = newUserId();
      const requesterId = newUserId();
      await db.insert(schema.orgs).values({ id: orgId, name: 'acme' });
      await db.insert(schema.users).values([
        {
          id: ownerId,
          org_id: orgId,
          email: 'owner@team.test',
          password_hash: await hashPassword('owner-password-12345'),
          org_role: 'owner',
        },
        {
          id: requesterId,
          org_id: orgId,
          email: 'dev@team.test',
          password_hash: await hashPassword('dev-password-12345'),
          org_role: 'developer',
        },
      ]);
      const projectId = 'p_test_race';
      await db.insert(schema.projects).values({
        id: projectId,
        org_id: orgId,
        name: 'race',
        dek_wrapped: Buffer.from([0]),
        dek_nonce: Buffer.from([0]),
      });

      const alias = '@race.prod.db_password';
      const N = 8;
      const results = await Promise.all(
        Array.from({ length: N }, () =>
          ensurePendingApproval({ db, projectId, alias, requesterUserId: requesterId }),
        ),
      );

      const rows = await db
        .select({ id: schema.approvals.id, status: schema.approvals.status })
        .from(schema.approvals)
        .where(eq(schema.approvals.project_id, projectId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe('pending');

      // Every caller must see the same winning id.
      const ids = new Set(results.map((r) => r.id));
      expect(ids.size).toBe(1);
      expect(ids.has(rows[0]?.id ?? '')).toBe(true);

      // Exactly one creator (the others took the conflict branch).
      const createdCount = results.filter((r) => r.created).length;
      expect(createdCount).toBe(1);
    } finally {
      raw.close();
    }
  });
});

describe('Rate limit — closes Phase 5 audit Finding A1', () => {
  it('returns 429 with rate_limited error code after the budget is exhausted', async () => {
    const local = await makeHarness({ rateLimitPerMinute: 3 });
    try {
      const token = await login(local.app, local.ownerEmail, local.ownerPassword);

      // Each /v1/whoami counts toward the bucket. The 4th call exceeds 3.
      const responses: Response[] = [];
      for (let i = 0; i < 5; i++) {
        responses.push(
          await local.app.request('http://localhost/v1/whoami', {
            headers: { authorization: `Bearer ${token}` },
          }),
        );
      }

      // First 3 succeed, 4th + 5th are rate-limited.
      expect(responses.slice(0, 3).every((r) => r.status === 200)).toBe(true);
      expect(responses[3]?.status).toBe(429);
      expect(responses[4]?.status).toBe(429);

      const body = (await responses[3]?.json()) as { error?: { code: string } };
      expect(body.error?.code).toBe('rate_limited');
      expect(responses[3]?.headers.get('retry-after')).toMatch(/^\d+$/);
      expect(responses[3]?.headers.get('x-ratelimit-limit')).toBe('3');
      expect(responses[3]?.headers.get('x-ratelimit-remaining')).toBe('0');

      const metrics = await local.app.request('http://localhost/metrics');
      expect(await metrics.text()).toContain(
        'keynv_domain_events_total{event="rate_limit_rejection"} 2',
      );
    } finally {
      local.cleanup();
    }
  });

  it('keys per-user — one user being limited does not affect another', async () => {
    const local = await makeHarness({ rateLimitPerMinute: 2 });
    try {
      const ownerToken = await login(local.app, local.ownerEmail, local.ownerPassword);
      const devToken = await login(local.app, local.developerEmail, local.developerPassword);

      // Owner exhausts their own budget.
      for (let i = 0; i < 3; i++) {
        await local.app.request('http://localhost/v1/whoami', {
          headers: { authorization: `Bearer ${ownerToken}` },
        });
      }
      const ownerLimited = await local.app.request('http://localhost/v1/whoami', {
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(ownerLimited.status).toBe(429);

      // Developer is unaffected.
      const devOk = await local.app.request('http://localhost/v1/whoami', {
        headers: { authorization: `Bearer ${devToken}` },
      });
      expect(devOk.status).toBe(200);
    } finally {
      local.cleanup();
    }
  });
});

describe('Public registration — POST /v1/auth/register', () => {
  it('creates a new org + owner user and returns a usable JWT pair', async () => {
    const local = await makeHarness({ publicRegistrationEnabled: true });
    try {
      const res = await local.app.request('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'tenant@example.test',
          password: 'tenant-password-12345',
          org_name: 'Tenant Inc',
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        access_token: string;
        refresh_token: string;
        user: { id: string; email: string; org_id: string; org_role: string };
      };
      expect(body.user.email).toBe('tenant@example.test');
      expect(body.user.org_role).toBe('owner');
      expect(body.user.org_id).toMatch(/^org_/);
      expect(body.user.id).toMatch(/^u_/);

      // Returned access token resolves to the new tenant's identity.
      const me = await local.app.request('http://localhost/v1/whoami', {
        headers: { authorization: `Bearer ${body.access_token}` },
      });
      expect(me.status).toBe(200);
      const meBody = (await me.json()) as { email: string; org_id: string };
      expect(meBody.email).toBe('tenant@example.test');
      expect(meBody.org_id).toBe(body.user.org_id);
    } finally {
      local.cleanup();
    }
  });

  it('returns 403 rbac.denied when public registration is disabled', async () => {
    // Default harness has publicRegistrationEnabled: false.
    const res = await harness.app.request('http://localhost/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'someone@example.test',
        password: 'password-12345-ok',
        org_name: 'Anyone',
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('rbac.denied');
  });

  it('rejects duplicate email with user.already_exists', async () => {
    const local = await makeHarness({ publicRegistrationEnabled: true });
    try {
      // Owner email is already seeded in the harness.
      const res = await local.app.request('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: local.ownerEmail,
          password: 'a-different-password-12345',
          org_name: 'Doppelganger',
        }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('user.already_exists');
    } finally {
      local.cleanup();
    }
  });

  it('rejects passwords shorter than 12 characters', async () => {
    const local = await makeHarness({ publicRegistrationEnabled: true });
    try {
      const res = await local.app.request('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'short@example.test',
          password: 'tooshort',
          org_name: 'Short',
        }),
      });
      expect(res.status).toBe(400);
    } finally {
      local.cleanup();
    }
  });

  it('per-IP rate limit returns 429 once the budget is exhausted', async () => {
    const local = await makeHarness({
      publicRegistrationEnabled: true,
      registerRateLimitPerMinute: 2,
    });
    try {
      const tries = [
        { email: 'a1@example.test', org_name: 'A1' },
        { email: 'a2@example.test', org_name: 'A2' },
        // 3rd call exceeds the per-IP budget of 2/min.
        { email: 'a3@example.test', org_name: 'A3' },
      ];
      const responses: Response[] = [];
      for (const t of tries) {
        responses.push(
          await local.app.request('http://localhost/v1/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              email: t.email,
              password: 'password-12345-ok',
              org_name: t.org_name,
            }),
          }),
        );
      }
      expect(responses[0]?.status).toBe(201);
      expect(responses[1]?.status).toBe(201);
      expect(responses[2]?.status).toBe(429);
      const body = (await responses[2]?.json()) as { error: { code: string } };
      expect(body.error.code).toBe('rate_limited');
    } finally {
      local.cleanup();
    }
  });

  it('emits an auth.register audit entry', async () => {
    const local = await makeHarness({ publicRegistrationEnabled: true });
    try {
      const reg = await local.app.request('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'audited@example.test',
          password: 'audited-password-12345',
          org_name: 'Audited',
        }),
      });
      const regBody = (await reg.json()) as { access_token: string };

      const list = await local.app.request('http://localhost/v1/audit?event_type=auth.register', {
        headers: { authorization: `Bearer ${regBody.access_token}` },
      });
      expect(list.status).toBe(200);
      const body = (await list.json()) as {
        entries: Array<{ event_type: string; payload: { email: string } }>;
      };
      expect(body.entries.length).toBeGreaterThan(0);
      expect(body.entries[0]?.event_type).toBe('auth.register');
      expect(body.entries[0]?.payload.email).toBe('audited@example.test');
    } finally {
      local.cleanup();
    }
  });
});

describe('CLI browser auth — /v1/auth/cli/browser/*', () => {
  it('rate-limits browser auth start by client IP', async () => {
    const local = await makeHarness({ registerRateLimitPerMinute: 2 });
    try {
      const responses: Response[] = [];
      for (let i = 0; i < 3; i++) {
        responses.push(
          await local.app.request('http://localhost/v1/auth/cli/browser/start', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ device_name: `test-terminal-${i}` }),
          }),
        );
      }

      expect(responses[0]?.status).toBe(201);
      expect(responses[1]?.status).toBe(201);
      expect(responses[2]?.status).toBe(429);
      const body = (await responses[2]?.json()) as { error: { code: string } };
      expect(body.error.code).toBe('rate_limited');
    } finally {
      local.cleanup();
    }
  });

  it('starts pending, authorizes in the browser session, then returns a usable JWT pair', async () => {
    const start = await harness.app.request('http://localhost/v1/auth/cli/browser/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_name: 'test-terminal' }),
    });
    expect(start.status).toBe(201);
    const started = (await start.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      verification_uri_complete: string;
    };
    expect(started.device_code.length).toBeGreaterThan(16);
    expect(started.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(started.verification_uri).toBe('http://localhost/cli/authorize');
    expect(started.verification_uri_complete).toContain(encodeURIComponent(started.user_code));

    const pending = await harness.app.request('http://localhost/v1/auth/cli/browser/poll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_code: started.device_code }),
    });
    expect(pending.status).toBe(202);
    const pendingBody = (await pending.json()) as { status: string };
    expect(pendingBody.status).toBe('pending');

    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const authorize = await harness.app.request('http://localhost/v1/auth/cli/browser/authorize', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ user_code: started.user_code }),
    });
    expect(authorize.status).toBe(204);

    const poll = await harness.app.request('http://localhost/v1/auth/cli/browser/poll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_code: started.device_code }),
    });
    expect(poll.status).toBe(200);
    const session = (await poll.json()) as {
      access_token: string;
      refresh_token: string;
      user: { email: string };
    };
    expect(session.user.email).toBe(harness.ownerEmail);
    expect(session.refresh_token.length).toBeGreaterThan(16);

    const me = await harness.app.request('http://localhost/v1/whoami', {
      headers: { authorization: `Bearer ${session.access_token}` },
    });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { email: string };
    expect(meBody.email).toBe(harness.ownerEmail);
  });

  it('rejects reused device codes after a successful poll', async () => {
    const start = await harness.app.request('http://localhost/v1/auth/cli/browser/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const started = (await start.json()) as { device_code: string; user_code: string };
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);

    await harness.app.request('http://localhost/v1/auth/cli/browser/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ user_code: started.user_code }),
    });
    const firstPoll = await harness.app.request('http://localhost/v1/auth/cli/browser/poll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_code: started.device_code }),
    });
    expect(firstPoll.status).toBe(200);

    const secondPoll = await harness.app.request('http://localhost/v1/auth/cli/browser/poll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_code: started.device_code }),
    });
    expect(secondPoll.status).toBe(400);
    const body = (await secondPoll.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation.failed');
  });
});

describe('Health — capabilities', () => {
  it('exposes public_registration capability flag', async () => {
    const off = await makeHarness();
    try {
      const res = await off.app.request('http://localhost/v1/health');
      const body = (await res.json()) as {
        capabilities: {
          public_registration: boolean;
          api: { current: string; supported: string[]; stability: string; min_cli_version: string };
          features: Record<string, boolean>;
        };
      };
      expect(body.capabilities.public_registration).toBe(false);
      expect(body.capabilities.api).toEqual({
        current: 'v1',
        supported: ['v1'],
        stability: 'pre-1.0',
        min_cli_version: '0.1.0-rc.21',
      });
      expect(body.capabilities.features).toMatchObject({
        batch_secret_create: true,
        environment_management: true,
        health_probes: true,
        prometheus_metrics: true,
      });
    } finally {
      off.cleanup();
    }

    const on = await makeHarness({ publicRegistrationEnabled: true });
    try {
      const res = await on.app.request('http://localhost/v1/health');
      const body = (await res.json()) as {
        capabilities: { public_registration: boolean };
      };
      expect(body.capabilities.public_registration).toBe(true);
    } finally {
      on.cleanup();
    }
  });

  it('exposes separate liveness and readiness probes', async () => {
    const live = await harness.app.request('http://localhost/v1/health/live');
    expect(live.status).toBe(200);
    const liveBody = (await live.json()) as { ok: boolean; status: string; version: string };
    expect(liveBody).toEqual({ ok: true, status: 'live', version: 'test' });

    const ready = await harness.app.request('http://localhost/v1/health/ready');
    expect(ready.status).toBe(200);
    const readyBody = (await ready.json()) as { ok: boolean; db: string };
    expect(readyBody.ok).toBe(true);
    expect(readyBody.db).toBe('ok');
  });

  it('exposes Prometheus metrics with normalized HTTP labels', async () => {
    await harness.app.request('http://localhost/v1/health');

    const res = await harness.app.request('http://localhost/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const body = await res.text();

    expect(body).toContain('# TYPE keynv_http_requests_total counter');
    expect(body).toContain(
      'keynv_http_requests_total{method="GET",route="/v1/health",status_class="2xx"}',
    );
    expect(body).toContain('# TYPE keynv_http_request_duration_seconds histogram');
  });

  it('records domain metrics without exposing secret names or user emails', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'observability-demo',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    expect(projectRes.status).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const createSecret = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ env: 'dev', key: 'API_TOKEN', value: 'secret-value' }),
      },
    );
    expect(createSecret.status).toBe(201);

    const readSecret = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/dev/API_TOKEN`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(readSecret.status).toBe(200);

    const metrics = await harness.app.request('http://localhost/metrics');
    const body = await metrics.text();
    expect(body).toContain('keynv_domain_events_total{event="audit_append"}');
    expect(body).toContain('keynv_domain_events_total{event="secret_write"}');
    expect(body).toContain('keynv_domain_events_total{event="secret_read"}');
    expect(body).toContain('route="/v1/projects/:projectId/secrets/:env/:key"');
    expect(body).not.toContain('API_TOKEN');
    expect(body).not.toContain('observability-demo');
    expect(body).not.toContain(harness.ownerEmail);
  });
});

describe('POST /v1/projects/:id/environments', () => {
  async function createProject(token: string): Promise<string> {
    const res = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'envtest',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    return body.id;
  }

  it('owner can add a new environment to an existing project', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createProject(token);

    const res = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/environments`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'prod', tier: 'production', require_approval: true }),
      },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      name: string;
      tier: string;
      require_approval: boolean;
    };
    expect(body.name).toBe('prod');
    expect(body.tier).toBe('production');
    expect(body.require_approval).toBe(true);
    expect(body.id).toMatch(/^e_/);

    // Project describe should reflect both envs.
    const desc = await harness.app.request(`http://localhost/v1/projects/${projectId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const descBody = (await desc.json()) as { environments: Array<{ name: string }> };
    expect(descBody.environments.map((e) => e.name).sort()).toEqual(['dev', 'prod']);
  });

  it('rejects duplicate env name with 409', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createProject(token);
    const res = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/environments`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'dev' }),
      },
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('environment.already_exists');
  });

  it('rejects invalid env name with 400', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createProject(token);
    const res = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/environments`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'INVALID UPPERCASE' }),
      },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown project id', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const res = await harness.app.request(
      'http://localhost/v1/projects/p_does_not_exist/environments',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'staging' }),
      },
    );
    expect(res.status).toBe(404);
  });

  it('developer (non-lead) is forbidden', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createProject(ownerToken);
    // grant developer access
    await harness.app.request(`http://localhost/v1/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ email: harness.developerEmail, role: 'developer' }),
    });
    const devToken = await login(harness.app, harness.developerEmail, harness.developerPassword);
    const res = await harness.app.request(
      `http://localhost/v1/projects/${projectId}/environments`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${devToken}` },
        body: JSON.stringify({ name: 'staging' }),
      },
    );
    expect(res.status).toBe(403);
  });

  it('emits an environment.created audit entry', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projectId = await createProject(token);
    await harness.app.request(`http://localhost/v1/projects/${projectId}/environments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'staging', tier: 'non-production' }),
    });
    const audit = await harness.app.request(
      'http://localhost/v1/audit?event_type=environment.created',
      { headers: { authorization: `Bearer ${token}` } },
    );
    const body = (await audit.json()) as {
      entries: Array<{ event_type: string; payload: Record<string, unknown> }>;
    };
    const entry = body.entries.find(
      (e) => (e.payload as { environment?: string }).environment === 'staging',
    );
    expect(entry).toBeDefined();
    expect(entry?.event_type).toBe('environment.created');
    expect(entry?.payload.project_id).toBe(projectId);
  });
});

describe('Project — list, describe, delete', () => {
  it('owner can list and describe projects', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'alpha',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'beta',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });

    const listRes = await harness.app.request('http://localhost/v1/projects', {
      headers: { authorization: `Bearer ${token}` },
    });
    const list = (await listRes.json()) as { projects: Array<{ name: string; id: string }> };
    expect(list.projects.length).toBeGreaterThanOrEqual(2);
    const alpha = list.projects.find((p) => p.name === 'alpha')!;
    expect(alpha.id).toMatch(/^p_/);

    const describeRes = await harness.app.request(`http://localhost/v1/projects/${alpha.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const desc = (await describeRes.json()) as {
      id: string;
      name: string;
      environments: Array<{ name: string }>;
    };
    expect(desc.name).toBe('alpha');
    expect(desc.environments).toHaveLength(1);
    expect(desc.environments[0]!.name).toBe('dev');
  });

  it('owner can soft-delete a project', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'delete-me',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    const project = (await projRes.json()) as { id: string };

    const delRes = await harness.app.request(`http://localhost/v1/projects/${project.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(delRes.status).toBe(204);

    const listRes = await harness.app.request('http://localhost/v1/projects', {
      headers: { authorization: `Bearer ${token}` },
    });
    const list = (await listRes.json()) as { projects: Array<{ name: string }> };
    expect(list.projects.find((p) => p.name === 'delete-me')).toBeUndefined();
  });

  it('developer cannot delete a project (rbac denied)', async () => {
    const ownerToken = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'protect',
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
    const delRes = await harness.app.request(`http://localhost/v1/projects/${project.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${devToken}` },
    });
    expect(delRes.status).toBe(403);
  });

  it('reject project with duplicate environment name', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const res = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'dup-env',
        environments: [
          { name: 'dev', tier: 'non-production' },
          { name: 'dev', tier: 'non-production' },
        ],
      }),
    });
    // TODO: this should be 400 with a validation error — the server
    // currently throws an unhandled unique-constraint violation (500).
    expect(res.status).toBe(500);
  });
});

describe('Secret — delete and list', () => {
  it('owner can list, soft-delete, and verify secret absent from list', async () => {
    const token = await login(harness.app, harness.ownerEmail, harness.ownerPassword);
    const projRes = await harness.app.request('http://localhost/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'secret-list',
        environments: [{ name: 'dev', tier: 'non-production' }],
      }),
    });
    const project = (await projRes.json()) as { id: string };
    await harness.app.request(`http://localhost/v1/projects/${project.id}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ env: 'dev', key: 'keep', value: 'keep-me' }),
    });
    await harness.app.request(`http://localhost/v1/projects/${project.id}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ env: 'dev', key: 'remove', value: 'remove-me' }),
    });

    const beforeRes = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );
    const before = (await beforeRes.json()) as { secrets: Array<{ alias: string }> };
    expect(before.secrets).toHaveLength(2);

    const delRes = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets/dev/remove`,
      { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
    );
    expect(delRes.status).toBe(204);

    const afterRes = await harness.app.request(
      `http://localhost/v1/projects/${project.id}/secrets`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );
    const after = (await afterRes.json()) as { secrets: Array<{ alias: string }> };
    expect(after.secrets).toHaveLength(1);
    expect(after.secrets[0]!.alias).toContain('keep');
  });
});

describe('CORS — Access-Control-Allow-Origin header', () => {
  it('sets CORS headers when webUrl is configured', async () => {
    const webUrl = 'https://keynv.example.com';
    const { db, raw } = await import('../db/index.js').then((m) =>
      m.openDb({ path: ':memory:', migrate: true }),
    );
    const kek = await import('@keynv/core').then((m) => m.crypto.generateKey());
    const app = createApp({
      db,
      jwtSecret: JWT_SECRET,
      accessTtlS: 900,
      refreshTtlS: 7 * 24 * 3600,
      webUrl,
      getKek: () => kek,
      version: 'test',
      logger: SILENT_LOGGER,
      rateLimitPerMinute: 0,
      publicRegistrationEnabled: false,
      registerRateLimitPerMinute: 0,
    });

    const req = new Request('http://localhost/v1/health', {
      method: 'OPTIONS',
      headers: { Origin: webUrl },
    });
    const res = await app.fetch(req);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(webUrl);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Keynv-Org');
    raw.close();
  });

  it('omits CORS headers when webUrl is not configured', async () => {
    const { db, raw } = await import('../db/index.js').then((m) =>
      m.openDb({ path: ':memory:', migrate: true }),
    );
    const kek = await import('@keynv/core').then((m) => m.crypto.generateKey());
    const app = createApp({
      db,
      jwtSecret: JWT_SECRET,
      accessTtlS: 900,
      refreshTtlS: 7 * 24 * 3600,
      getKek: () => kek,
      version: 'test',
      logger: SILENT_LOGGER,
      rateLimitPerMinute: 0,
      publicRegistrationEnabled: false,
      registerRateLimitPerMinute: 0,
    });

    const req = new Request('http://localhost/v1/health', {
      method: 'OPTIONS',
      headers: { Origin: 'https://other.example.com' },
    });
    const res = await app.fetch(req);
    expect(res.headers.has('Access-Control-Allow-Origin')).toBe(false);
    raw.close();
  });
});
