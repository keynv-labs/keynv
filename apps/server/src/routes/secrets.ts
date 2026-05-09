import { crypto } from '@keynv/core';
import { authorize } from '@keynv/rbac';
import { findTester, runTest } from '@keynv/testers';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit/append.js';
import { authMiddleware } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';
import { newSecretId } from '../lib/id.js';

interface SecretDeps {
  db: Db;
  jwtSecret: string;
  getKek: () => Uint8Array;
}

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const CreateSecretBody = z.object({
  env: z
    .string()
    .min(1)
    .max(24)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  key: z.string().min(1).max(64).regex(KEY_RE),
  value: z
    .string()
    .min(0)
    .max(1024 * 64),
});

const RotateSecretBody = z.object({
  new_value: z
    .string()
    .min(0)
    .max(1024 * 64),
});

/**
 * Loads a project + unwraps its DEK if and only if `projectId` belongs
 * to `orgId`. Returns null on cross-org access (audit finding B2);
 * callers respond with 404 so the existence of cross-org projects is
 * not disclosed.
 */
async function loadProjectDek(
  db: Db,
  projectId: string,
  orgId: string,
  kek: Uint8Array,
): Promise<{ project: typeof schema.projects.$inferSelect; dek: Uint8Array } | null> {
  const rows = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.org_id, orgId),
        isNull(schema.projects.deleted_at),
      ),
    )
    .limit(1);
  const project = rows[0];
  if (!project) return null;
  const dek = await crypto.unwrapDek(
    {
      ciphertext: new Uint8Array(project.dek_wrapped),
      nonce: new Uint8Array(project.dek_nonce),
    },
    kek,
  );
  return { project, dek };
}

export function secretRoutes(deps: SecretDeps): Hono {
  const r = new Hono();
  r.use(
    '*',
    authMiddleware(() => ({ db: deps.db, jwtSecret: deps.jwtSecret })),
  );

  // POST /v1/projects/:id/secrets
  r.post('/:projectId/secrets', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    if (authorize('secret.create', { user, resource: { project_id: projectId } }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const parsed = CreateSecretBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid secret body.');

    // Verify project belongs to caller's org BEFORE any env probing
    // (audit B2 — env query alone would leak existence cross-org).
    const loaded = await loadProjectDek(deps.db, projectId, user.org_id, deps.getKek());
    if (!loaded) return jsonError(c, 'project.not_found', 'Project not found.');

    const envRows = await deps.db
      .select()
      .from(schema.environments)
      .where(
        and(
          eq(schema.environments.project_id, projectId),
          eq(schema.environments.name, parsed.data.env),
        ),
      )
      .limit(1);
    const env = envRows[0];
    if (!env) return jsonError(c, 'environment.not_found', 'Environment not found.');

    const existing = await deps.db
      .select({ id: schema.secrets.id })
      .from(schema.secrets)
      .where(
        and(
          eq(schema.secrets.project_id, projectId),
          eq(schema.secrets.environment_id, env.id),
          eq(schema.secrets.key, parsed.data.key),
          isNull(schema.secrets.deleted_at),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return jsonError(c, 'secret.already_exists', 'Secret already exists. Use rotate to update.');
    }

    const sealed = await crypto.encryptSecret(parsed.data.value, loaded.dek);
    const id = newSecretId();
    await deps.db.insert(schema.secrets).values({
      id,
      project_id: projectId,
      environment_id: env.id,
      key: parsed.data.key,
      ciphertext: Buffer.from(sealed.ciphertext),
      nonce: Buffer.from(sealed.nonce),
      version: 1,
      created_by: user.id,
    });

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'secret.created',
      payload: {
        project_id: projectId,
        env: env.name,
        key: parsed.data.key,
        version: 1,
      },
    });

    return c.json(
      {
        alias: `@${loaded.project.name}.${env.name}.${parsed.data.key}`,
        version: 1,
      },
      201,
    );
  });

  // GET /v1/projects/:id/secrets — list alias names only
  r.get('/:projectId/secrets', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    if (authorize('secret.list_names', { user, resource: { project_id: projectId } }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const projectRows = await deps.db
      .select({ name: schema.projects.name })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.org_id, user.org_id),
          isNull(schema.projects.deleted_at),
        ),
      )
      .limit(1);
    const project = projectRows[0];
    if (!project) return jsonError(c, 'project.not_found', 'Project not found.');

    const rows = await deps.db
      .select({
        env_name: schema.environments.name,
        key: schema.secrets.key,
        version: schema.secrets.version,
        created_at: schema.secrets.created_at,
        deleted_at: schema.secrets.deleted_at,
      })
      .from(schema.secrets)
      .innerJoin(schema.environments, eq(schema.secrets.environment_id, schema.environments.id))
      .where(eq(schema.secrets.project_id, projectId));

    const aliases: Array<{ alias: string; version: number; created_at: string }> = [];
    const seen = new Set<string>();
    for (const row of rows.sort((a, b) => b.version - a.version)) {
      if (row.deleted_at) continue;
      const alias = `@${project.name}.${row.env_name}.${row.key}`;
      if (seen.has(alias)) continue;
      seen.add(alias);
      aliases.push({ alias, version: row.version, created_at: row.created_at });
    }
    return c.json({ secrets: aliases });
  });

  // GET /v1/projects/:id/secrets/:env/:key — resolve
  r.get('/:projectId/secrets/:env/:key', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    const envName = c.req.param('env');
    const keyName = c.req.param('key');

    // org_id-scoped project lookup FIRST so the env query below cannot
    // confirm the existence of cross-org projects via env probing
    // (audit finding B2).
    const projectRows = await deps.db
      .select({ name: schema.projects.name })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.org_id, user.org_id),
          isNull(schema.projects.deleted_at),
        ),
      )
      .limit(1);
    const projectRow = projectRows[0];
    if (!projectRow) return jsonError(c, 'project.not_found', 'Project not found.');

    const envRows = await deps.db
      .select()
      .from(schema.environments)
      .where(
        and(eq(schema.environments.project_id, projectId), eq(schema.environments.name, envName)),
      )
      .limit(1);
    const env = envRows[0];
    if (!env) return jsonError(c, 'environment.not_found', 'Environment not found.');

    const decision = authorize('secret.read', {
      user,
      resource: {
        project_id: projectId,
        environment_tier: env.tier,
        require_approval: env.require_approval,
      },
    });

    const alias = `@${projectRow.name}.${envName}.${keyName}`;

    if (decision === 'pending_approval') {
      await appendAudit(deps.db, {
        actor_user_id: user.id,
        actor_agent: readAgent(c),
        event_type: 'approval.requested',
        payload: { alias },
      });
      return jsonError(c, 'rbac.approval_required', 'Production access requires approval.');
    }
    if (decision !== 'allow') {
      await appendAudit(deps.db, {
        actor_user_id: user.id,
        actor_agent: readAgent(c),
        event_type: 'secret.read.denied',
        payload: { alias },
      });
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }

    const rows = await deps.db
      .select()
      .from(schema.secrets)
      .where(
        and(
          eq(schema.secrets.project_id, projectId),
          eq(schema.secrets.environment_id, env.id),
          eq(schema.secrets.key, keyName),
          isNull(schema.secrets.deleted_at),
        ),
      )
      .orderBy(desc(schema.secrets.version))
      .limit(1);
    const secret = rows[0];
    if (!secret) return jsonError(c, 'secret.not_found', 'Secret not found.');

    const loaded = await loadProjectDek(deps.db, projectId, user.org_id, deps.getKek());
    if (!loaded) return jsonError(c, 'project.not_found', 'Project not found.');

    const value = await crypto.decryptSecret(
      {
        ciphertext: new Uint8Array(secret.ciphertext),
        nonce: new Uint8Array(secret.nonce),
      },
      loaded.dek,
    );

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'secret.read.allowed',
      payload: { alias, version: secret.version },
    });

    return c.json({
      alias,
      value,
      version: secret.version,
    });
  });

  // POST /v1/projects/:id/secrets/:env/:key/rotate
  r.post('/:projectId/secrets/:env/:key/rotate', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    const envName = c.req.param('env');
    const keyName = c.req.param('key');

    if (authorize('secret.rotate', { user, resource: { project_id: projectId } }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const parsed = RotateSecretBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid rotate body.');

    // Org-scope project lookup before any env probing (audit B2).
    const projectRows = await deps.db
      .select({ name: schema.projects.name })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.org_id, user.org_id),
          isNull(schema.projects.deleted_at),
        ),
      )
      .limit(1);
    const projectRow = projectRows[0];
    if (!projectRow) return jsonError(c, 'project.not_found', 'Project not found.');

    const envRows = await deps.db
      .select()
      .from(schema.environments)
      .where(
        and(eq(schema.environments.project_id, projectId), eq(schema.environments.name, envName)),
      )
      .limit(1);
    const env = envRows[0];
    if (!env) return jsonError(c, 'environment.not_found', 'Environment not found.');

    const previousRows = await deps.db
      .select()
      .from(schema.secrets)
      .where(
        and(
          eq(schema.secrets.project_id, projectId),
          eq(schema.secrets.environment_id, env.id),
          eq(schema.secrets.key, keyName),
          isNull(schema.secrets.deleted_at),
        ),
      )
      .orderBy(desc(schema.secrets.version))
      .limit(1);
    const prev = previousRows[0];
    if (!prev) return jsonError(c, 'secret.not_found', 'Secret not found. Create it first.');

    const loaded = await loadProjectDek(deps.db, projectId, user.org_id, deps.getKek());
    if (!loaded) return jsonError(c, 'project.not_found', 'Project not found.');

    const sealed = await crypto.encryptSecret(parsed.data.new_value, loaded.dek);
    const newId = newSecretId();
    const newVersion = prev.version + 1;
    const now = new Date().toISOString();
    deps.db.transaction((tx) => {
      tx.insert(schema.secrets)
        .values({
          id: newId,
          project_id: projectId,
          environment_id: env.id,
          key: keyName,
          ciphertext: Buffer.from(sealed.ciphertext),
          nonce: Buffer.from(sealed.nonce),
          version: newVersion,
          prev_version_id: prev.id,
          created_by: user.id,
        })
        .run();
      tx.update(schema.secrets)
        .set({ deleted_at: now })
        .where(eq(schema.secrets.id, prev.id))
        .run();
    });

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'secret.rotated',
      payload: {
        project_id: projectId,
        env: envName,
        key: keyName,
        from_version: prev.version,
        to_version: newVersion,
      },
    });

    return c.json({
      alias: `@${projectRow.name}.${envName}.${keyName}`,
      version: newVersion,
    });
  });

  // DELETE /v1/projects/:id/secrets/:env/:key
  r.delete('/:projectId/secrets/:env/:key', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    const envName = c.req.param('env');
    const keyName = c.req.param('key');
    if (authorize('secret.delete', { user, resource: { project_id: projectId } }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    // Org-scope project lookup before env probing (audit B2).
    const projectRows = await deps.db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.org_id, user.org_id),
          isNull(schema.projects.deleted_at),
        ),
      )
      .limit(1);
    if (!projectRows[0]) return jsonError(c, 'project.not_found', 'Project not found.');

    const envRows = await deps.db
      .select()
      .from(schema.environments)
      .where(
        and(eq(schema.environments.project_id, projectId), eq(schema.environments.name, envName)),
      )
      .limit(1);
    const env = envRows[0];
    if (!env) return jsonError(c, 'environment.not_found', 'Environment not found.');

    const result = await deps.db
      .update(schema.secrets)
      .set({ deleted_at: new Date().toISOString() })
      .where(
        and(
          eq(schema.secrets.project_id, projectId),
          eq(schema.secrets.environment_id, env.id),
          eq(schema.secrets.key, keyName),
          isNull(schema.secrets.deleted_at),
        ),
      )
      .returning({ id: schema.secrets.id });
    if (result.length === 0) return jsonError(c, 'secret.not_found', 'Secret not found.');

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'secret.deleted',
      payload: { project_id: projectId, env: envName, key: keyName },
    });
    return c.body(null, 204);
  });

  // POST /v1/projects/:projectId/secrets/:env/:key/test
  // Decrypts the secret value, hands it to the requested tester
  // alongside the caller-supplied target shape, and returns the
  // sanitised TestResult. The plaintext value never leaves the
  // server process — it lives in memory only for the duration of
  // the test() call inside @keynv/testers.
  const TestBody = z.object({
    tester: z.enum(['postgres', 'mysql', 'redis', 'ssh', 'http']),
    target: z.record(z.string(), z.unknown()),
  });

  r.post('/:projectId/secrets/:env/:key/test', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    const envName = c.req.param('env');
    const keyName = c.req.param('key');

    const parsed = TestBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(c, 'validation.failed', 'Invalid test body.', {
        issues: parsed.error.issues,
      });
    }

    const projectRows = await deps.db
      .select({ name: schema.projects.name })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.org_id, user.org_id),
          isNull(schema.projects.deleted_at),
        ),
      )
      .limit(1);
    const projectRow = projectRows[0];
    if (!projectRow) return jsonError(c, 'project.not_found', 'Project not found.');

    const envRows = await deps.db
      .select()
      .from(schema.environments)
      .where(
        and(eq(schema.environments.project_id, projectId), eq(schema.environments.name, envName)),
      )
      .limit(1);
    const env = envRows[0];
    if (!env) return jsonError(c, 'environment.not_found', 'Environment not found.');

    const decision = authorize('secret.test', {
      user,
      resource: {
        project_id: projectId,
        environment_tier: env.tier,
        require_approval: env.require_approval,
      },
    });
    if (decision !== 'allow') return jsonError(c, 'rbac.denied', 'Permission denied.');

    const secretRows = await deps.db
      .select()
      .from(schema.secrets)
      .where(
        and(
          eq(schema.secrets.project_id, projectId),
          eq(schema.secrets.environment_id, env.id),
          eq(schema.secrets.key, keyName),
          isNull(schema.secrets.deleted_at),
        ),
      )
      .orderBy(desc(schema.secrets.version))
      .limit(1);
    const secret = secretRows[0];
    if (!secret) return jsonError(c, 'secret.not_found', 'Secret not found.');

    const loaded = await loadProjectDek(deps.db, projectId, user.org_id, deps.getKek());
    if (!loaded) return jsonError(c, 'project.not_found', 'Project not found.');

    const value = await crypto.decryptSecret(
      {
        ciphertext: new Uint8Array(secret.ciphertext),
        nonce: new Uint8Array(secret.nonce),
      },
      loaded.dek,
    );

    const alias = `@${projectRow.name}.${envName}.${keyName}`;
    const tester = findTester(parsed.data.tester);
    if (!tester) {
      return jsonError(c, 'validation.failed', `Unknown tester type: ${parsed.data.tester}`);
    }

    const result = await runTest({
      tester,
      secret: { alias, value },
      target: parsed.data.target,
    });

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'secret.test.invoked',
      payload: {
        alias,
        tester: parsed.data.tester,
        ok: result.ok,
        latency_ms: result.latency_ms,
      },
    });

    return c.json(result);
  });

  return r;
}
