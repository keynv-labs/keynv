import { crypto } from '@keynv/core';
import { authorize } from '@keynv/rbac';
import { and, eq, isNull, count, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { jsonError } from '../lib/errors.js';
import { newEnvironmentId, newProjectId } from '../lib/id.js';
import { authedChain } from '../lib/middleware-chain.js';
import { parseBody, guard, audit } from '../lib/route-utils.js';

interface ProjectDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
  /** Returns the master KEK loaded at server startup. */
  getKek: () => Uint8Array;
}

const EnvironmentBody = z.object({
  name: z
    .string()
    .min(1)
    .max(24)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  tier: z.enum(['production', 'non-production']).default('non-production'),
  require_approval: z.boolean().default(false),
});

const CreateProjectBody = z.object({
  name: z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'project name must be lowercase kebab-case'),
  environments: z.array(EnvironmentBody).min(1).max(16),
});

const AddEnvironmentBody = EnvironmentBody;

export function projectRoutes(deps: ProjectDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

  /**
   * GET /v1/projects/summary
   *
   * Aggregate view of all projects with env count, active secret count,
   * and pending approval count — in one query. Avoids the N+1 waterfall
   * the dashboard used to do when it called /:id + /:id/secrets +
   * /:id/approvals per project.
   */
  r.get('/summary', async (c) => {
    const user = c.var.user;
    const isAdmin = user.org_role === 'owner' || user.org_role === 'admin';

    // Admin sees all org projects; others see only their memberships
    const projectFilter = isAdmin
      ? eq(schema.projects.org_id, user.org_id)
      : user.memberships.length > 0
        ? sql`${schema.projects.id} IN ${sql.join(
            user.memberships.map((m) => m.project_id),
            sql`, `,
          )}`
        : sql`1=0`;

    const rows = await deps.db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        created_at: schema.projects.created_at,
        env_count: count(schema.environments.id),
        secret_count: count(schema.secrets.id),
        pending_count: sql<number>`(SELECT COUNT(*) FROM approvals WHERE project_id = projects.id AND status = 'pending')`,
      })
      .from(schema.projects)
      .leftJoin(schema.environments, eq(schema.environments.project_id, schema.projects.id))
      .leftJoin(schema.secrets, eq(schema.secrets.project_id, schema.projects.id))
      .where(and(isNull(schema.projects.deleted_at), projectFilter))
      .groupBy(schema.projects.id);

    return c.json({ projects: rows });
  });

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
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        created_at: schema.projects.created_at,
      })
      .from(schema.projects)
      .where(and(eq(schema.projects.org_id, user.org_id), isNull(schema.projects.deleted_at)));
    return c.json({ projects: rows });
  });

  r.post('/', async (c) => {
    const g = guard(c, 'project.create');
    if ('errorResponse' in g) return g.errorResponse;
    const user = g.user;
    const parsed = await parseBody(c, CreateProjectBody, 'Invalid project body.');
    if ('errorResponse' in parsed) return parsed.errorResponse;

    const existing = await deps.db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(
        and(eq(schema.projects.org_id, user.org_id), eq(schema.projects.name, parsed.data.name)),
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

    await audit(c, deps.db, 'project.created', {
      project_id: projectId,
      name: parsed.data.name,
      environments: parsed.data.environments.map((e) => e.name),
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
    const gd = guard(c, 'project.describe', { project_id: id });
    if ('errorResponse' in gd) return gd.errorResponse;
    const projectRows = await deps.db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, id),
          eq(schema.projects.org_id, user.org_id),
          isNull(schema.projects.deleted_at),
        ),
      )
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

  r.post('/:id/environments', async (c) => {
    const id = c.req.param('id');
    const ge = guard(c, 'environment.create', { project_id: id });
    if ('errorResponse' in ge) return ge.errorResponse;
    const user = ge.user;

    const projectRows = await deps.db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, id),
          eq(schema.projects.org_id, user.org_id),
          isNull(schema.projects.deleted_at),
        ),
      )
      .limit(1);
    if (!projectRows[0]) return jsonError(c, 'project.not_found', 'Project not found.');

    const parsed = await parseBody(c, AddEnvironmentBody, 'Invalid environment body.');
    if ('errorResponse' in parsed) return parsed.errorResponse;

    const existing = await deps.db
      .select({ id: schema.environments.id })
      .from(schema.environments)
      .where(
        and(eq(schema.environments.project_id, id), eq(schema.environments.name, parsed.data.name)),
      )
      .limit(1);
    if (existing[0]) {
      return jsonError(
        c,
        'environment.already_exists',
        `Environment '${parsed.data.name}' already exists on this project.`,
      );
    }

    const envId = newEnvironmentId();
    await deps.db.insert(schema.environments).values({
      id: envId,
      project_id: id,
      name: parsed.data.name,
      tier: parsed.data.tier,
      require_approval: parsed.data.require_approval,
    });

    await audit(c, deps.db, 'environment.created', {
      project_id: id,
      environment: parsed.data.name,
      tier: parsed.data.tier,
      require_approval: parsed.data.require_approval,
    });

    return c.json(
      {
        id: envId,
        name: parsed.data.name,
        tier: parsed.data.tier,
        require_approval: parsed.data.require_approval,
      },
      201,
    );
  });

  r.delete('/:id', async (c) => {
    const gd2 = guard(c, 'project.delete');
    if ('errorResponse' in gd2) return gd2.errorResponse;
    const user = gd2.user;
    const id = c.req.param('id');
    const projectRows = await deps.db
      .select({ id: schema.projects.id, name: schema.projects.name })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, id),
          eq(schema.projects.org_id, user.org_id),
          isNull(schema.projects.deleted_at),
        ),
      )
      .limit(1);
    const project = projectRows[0];
    if (!project) return jsonError(c, 'project.not_found', 'Project not found.');
    await deps.db
      .update(schema.projects)
      .set({ deleted_at: new Date().toISOString() })
      .where(eq(schema.projects.id, id));
    await audit(c, deps.db, 'project.deleted', { project_id: id, name: project.name });
    return c.body(null, 204);
  });

  return r;
}
