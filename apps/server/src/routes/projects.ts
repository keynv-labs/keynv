import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { authorize } from '@keynv/rbac';
import { crypto } from '@keynv/core';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { authMiddleware } from '../auth/middleware.js';
import { appendAudit } from '../audit/append.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';
import { newEnvironmentId, newProjectId } from '../lib/id.js';

interface ProjectDeps {
  db: Db;
  jwtSecret: string;
  /** Returns the master KEK loaded at server startup. */
  getKek: () => Uint8Array;
}

const CreateProjectBody = z.object({
  name: z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'project name must be lowercase kebab-case'),
  environments: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .max(24)
          .regex(/^[a-z0-9][a-z0-9-]*$/),
        tier: z.enum(['production', 'non-production']).default('non-production'),
        require_approval: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(16),
});

export function projectRoutes(deps: ProjectDeps): Hono {
  const r = new Hono();
  r.use('*', authMiddleware(() => ({ db: deps.db, jwtSecret: deps.jwtSecret })));

  r.get('/', async (c) => {
    const user = c.var.user;
    const decision = authorize('project.describe', { user });
    // project.describe with no project_id is fine for owner/admin (lists all)
    if (decision === 'deny' && user.org_role !== 'owner' && user.org_role !== 'admin') {
      // For non-admins, list only projects they have membership on.
      const memberProjectIds = user.memberships.map((m) => m.project_id);
      if (memberProjectIds.length === 0) return c.json({ projects: [] });
      const rows = await deps.db
        .select()
        .from(schema.projects)
        .where(isNull(schema.projects.deleted_at));
      const filtered = rows.filter((row) => memberProjectIds.includes(row.id));
      return c.json({
        projects: filtered.map((p) => ({ id: p.id, name: p.name, created_at: p.created_at })),
      });
    }

    const rows = await deps.db
      .select({ id: schema.projects.id, name: schema.projects.name, created_at: schema.projects.created_at })
      .from(schema.projects)
      .where(and(eq(schema.projects.org_id, user.org_id), isNull(schema.projects.deleted_at)));
    return c.json({ projects: rows });
  });

  r.post('/', async (c) => {
    const user = c.var.user;
    if (authorize('project.create', { user }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const parsed = CreateProjectBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(c, 'validation.failed', 'Invalid project body.', {
        issues: parsed.error.issues,
      });
    }

    const existing = await deps.db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.org_id, user.org_id),
          eq(schema.projects.name, parsed.data.name),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return jsonError(c, 'project.already_exists', `Project ${parsed.data.name} already exists.`);
    }

    const dek = await crypto.generateKey();
    const wrapped = await crypto.wrapDek(dek, deps.getKek());
    const projectId = newProjectId();
    const envInserts = parsed.data.environments.map((env) => ({
      id: newEnvironmentId(),
      project_id: projectId,
      name: env.name,
      tier: env.tier,
      require_approval: env.require_approval,
    }));

    deps.db.transaction((tx) => {
      tx.insert(schema.projects)
        .values({
          id: projectId,
          org_id: user.org_id,
          name: parsed.data.name,
          dek_wrapped: Buffer.from(wrapped.ciphertext),
          dek_nonce: Buffer.from(wrapped.nonce),
        })
        .run();
      for (const row of envInserts) {
        tx.insert(schema.environments).values(row).run();
      }
    });

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'project.created',
      payload: {
        project_id: projectId,
        name: parsed.data.name,
        environments: parsed.data.environments.map((e) => e.name),
      },
    });

    return c.json(
      {
        id: projectId,
        name: parsed.data.name,
        environments: parsed.data.environments,
      },
      201,
    );
  });

  r.get('/:id', async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    if (authorize('project.describe', { user, resource: { project_id: id } }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const projectRows = await deps.db
      .select()
      .from(schema.projects)
      .where(and(eq(schema.projects.id, id), isNull(schema.projects.deleted_at)))
      .limit(1);
    const project = projectRows[0];
    if (!project) return jsonError(c, 'project.not_found', 'Project not found.');
    const envRows = await deps.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.project_id, id));
    return c.json({
      id: project.id,
      name: project.name,
      created_at: project.created_at,
      environments: envRows.map((e) => ({
        id: e.id,
        name: e.name,
        tier: e.tier,
        require_approval: e.require_approval,
      })),
    });
  });

  r.delete('/:id', async (c) => {
    const user = c.var.user;
    if (authorize('project.delete', { user }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const id = c.req.param('id');
    const projectRows = await deps.db
      .select({ id: schema.projects.id, name: schema.projects.name })
      .from(schema.projects)
      .where(and(eq(schema.projects.id, id), isNull(schema.projects.deleted_at)))
      .limit(1);
    const project = projectRows[0];
    if (!project) return jsonError(c, 'project.not_found', 'Project not found.');
    await deps.db
      .update(schema.projects)
      .set({ deleted_at: new Date().toISOString() })
      .where(eq(schema.projects.id, id));
    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'project.deleted',
      payload: { project_id: id, name: project.name },
    });
    return c.body(null, 204);
  });

  return r;
}
