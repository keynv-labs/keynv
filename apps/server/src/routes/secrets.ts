import { crypto, validation } from '@keynv/core';
import { authorize } from '@keynv/rbac';
import { findTester, runTest, testerEnum } from '@keynv/testers';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { jsonError } from '../lib/errors.js';
import { newSecretId } from '../lib/id.js';
import { authedChain } from '../lib/middleware-chain.js';
import { audit, guard, parseBody } from '../lib/route-utils.js';
import { ensurePendingApproval, findActiveGrant } from './approvals.js';

interface SecretDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
  getKek: () => Uint8Array;
}

const CreateSecretBody = z.object({
  env: validation.envName,
  key: validation.secretKey,
  value: validation.secretValue,
});

const RotateSecretBody = z.object({
  new_value: validation.secretValue,
});

const TestBody = z.object({
  tester: testerEnum,
  target: z.record(z.string(), z.unknown()),
});

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
  r.use('*', ...authedChain(deps));

  r.post('/:projectId/secrets', async (c) => {
    const projectId = c.req.param('projectId');
    const g = guard(c, 'secret.create', { project_id: projectId });
    if ('errorResponse' in g) return g.errorResponse;
    const user = g.user;
    const body = await parseBody(c, CreateSecretBody, 'Invalid secret body.');
    if ('errorResponse' in body) return body.errorResponse;
    const { env: secretEnv, key: secretKey, value: secretValue } = body.data;

    const loaded = await loadProjectDek(deps.db, projectId, user.org_id, deps.getKek());
    if (!loaded) return jsonError(c, 'project.not_found', 'Project not found.');

    const envRows = await deps.db
      .select()
      .from(schema.environments)
      .where(
        and(eq(schema.environments.project_id, projectId), eq(schema.environments.name, secretEnv)),
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
          eq(schema.secrets.key, secretKey),
          isNull(schema.secrets.deleted_at),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return jsonError(c, 'secret.already_exists', 'Secret already exists. Use rotate to update.');
    }

    const sealed = await crypto.encryptSecret(secretValue, loaded.dek);
    const id = newSecretId();
    await deps.db.insert(schema.secrets).values({
      id,
      project_id: projectId,
      environment_id: env.id,
      key: secretKey,
      ciphertext: Buffer.from(sealed.ciphertext),
      nonce: Buffer.from(sealed.nonce),
      version: 1,
      created_by: user.id,
    });

    await audit(c, deps.db, 'secret.created', {
      project_id: projectId,
      env: env.name,
      key: secretKey,
      version: 1,
    });

    return c.json(
      {
        alias: `@${loaded.project.name}.${env.name}.${secretKey}`,
        version: 1,
      },
      201,
    );
  });

  r.get('/:projectId/secrets', async (c) => {
    const projectId = c.req.param('projectId');
    const g = guard(c, 'secret.list_names', { project_id: projectId });
    if ('errorResponse' in g) return g.errorResponse;
    const user = g.user;

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

  r.get('/:projectId/secrets/:env/:key', async (c) => {
    const user = c.var.user;
    if (!user) return jsonError(c, 'auth.missing_token', 'Not authenticated.');
    const projectId = c.req.param('projectId');
    const envName = c.req.param('env');
    const keyName = c.req.param('key');

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

    const alias = `@${projectRow.name}.${envName}.${keyName}`;

    const grant = await findActiveGrant({
      db: deps.db,
      projectId,
      alias,
      requesterUserId: user.id,
    });

    const decision = authorize('secret.read', {
      user,
      resource: {
        project_id: projectId,
        environment_tier: env.tier,
        require_approval: env.require_approval,
      },
      approval: grant ? { granted: true } : undefined,
    });

    if (decision === 'pending_approval') {
      const ensured = await ensurePendingApproval({
        db: deps.db,
        projectId,
        alias,
        requesterUserId: user.id,
      });
      if (ensured.created) {
        await audit(c, deps.db, 'approval.requested', { alias });
      }
      return jsonError(c, 'rbac.approval_required', 'Production access requires approval.');
    }
    if (decision !== 'allow') {
      await audit(c, deps.db, 'secret.read.denied', { alias });
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

    await audit(c, deps.db, 'secret.read.allowed', { alias, version: secret.version });

    return c.json({
      alias,
      value,
      version: secret.version,
    });
  });

  r.post('/:projectId/secrets/:env/:key/rotate', async (c) => {
    const projectId = c.req.param('projectId');
    const envName = c.req.param('env');
    const keyName = c.req.param('key');

    const g = guard(c, 'secret.rotate', { project_id: projectId });
    if ('errorResponse' in g) return g.errorResponse;
    const user = g.user;
    const body = await parseBody(c, RotateSecretBody, 'Invalid rotate body.');
    if ('errorResponse' in body) return body.errorResponse;

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

    const sealed = await crypto.encryptSecret(body.data.new_value, loaded.dek);
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

    await audit(c, deps.db, 'secret.rotated', {
      project_id: projectId,
      env: envName,
      key: keyName,
      from_version: prev.version,
      to_version: newVersion,
    });

    return c.json({
      alias: `@${projectRow.name}.${envName}.${keyName}`,
      version: newVersion,
    });
  });

  r.delete('/:projectId/secrets/:env/:key', async (c) => {
    const projectId = c.req.param('projectId');
    const envName = c.req.param('env');
    const keyName = c.req.param('key');

    const g = guard(c, 'secret.delete', { project_id: projectId });
    if ('errorResponse' in g) return g.errorResponse;
    const user = g.user;

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

    await audit(c, deps.db, 'secret.deleted', {
      project_id: projectId,
      env: envName,
      key: keyName,
    });
    return c.body(null, 204);
  });

  r.post('/:projectId/secrets/:env/:key/test', async (c) => {
    const projectId = c.req.param('projectId');
    const envName = c.req.param('env');
    const keyName = c.req.param('key');

    const body = await parseBody(c, TestBody, 'Invalid test body.');
    if ('errorResponse' in body) return body.errorResponse;

    const user = c.var.user;
    if (!user) return jsonError(c, 'auth.missing_token', 'Not authenticated.');

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

    const g = guard(c, 'secret.test', {
      project_id: projectId,
      environment_tier: env.tier,
      require_approval: env.require_approval,
    });
    if ('errorResponse' in g) return g.errorResponse;

    const alias = `@${projectRow.name}.${envName}.${keyName}`;

    const grant = await findActiveGrant({
      db: deps.db,
      projectId,
      alias,
      requesterUserId: g.user.id,
    });

    const approvalDecision = authorize('secret.test', {
      user: g.user,
      resource: {
        project_id: projectId,
        environment_tier: env.tier,
        require_approval: env.require_approval,
      },
      approval: grant ? { granted: true } : undefined,
    });
    if (approvalDecision === 'pending_approval') {
      const ensured = await ensurePendingApproval({
        db: deps.db,
        projectId,
        alias,
        requesterUserId: g.user.id,
      });
      if (ensured.created) {
        await audit(c, deps.db, 'approval.requested', { alias });
      }
      return jsonError(c, 'rbac.approval_required', 'Production test access requires approval.');
    }
    if (approvalDecision !== 'allow') {
      await audit(c, deps.db, 'secret.test.denied', { alias });
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }

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

    const tester = findTester(body.data.tester);
    if (!tester) {
      return jsonError(c, 'validation.failed', `Unknown tester type: ${body.data.tester}`);
    }

    const result = await runTest({
      tester,
      secret: { alias, value },
      target: body.data.target,
    });

    await audit(c, deps.db, 'secret.test.invoked', {
      alias,
      tester: body.data.tester,
      ok: result.ok,
      latency_ms: result.latency_ms,
    });

    return c.json(result);
  });

  return r;
}
