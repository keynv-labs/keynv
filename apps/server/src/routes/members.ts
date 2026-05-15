import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { jsonError } from '../lib/errors.js';
import { authedChain } from '../lib/middleware-chain.js';
import { audit, guard, parseBody } from '../lib/route-utils.js';

interface MemberDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

async function projectInOrg(db: Db, projectId: string, orgId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.org_id, orgId),
        isNull(schema.projects.deleted_at),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

const AddMemberBody = z.object({
  email: z.string().email(),
  role: z.enum(['lead', 'developer', 'reader']),
});

const PatchMemberBody = z.object({
  role: z.enum(['lead', 'developer', 'reader']),
});

export function memberRoutes(deps: MemberDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

  r.get('/:projectId/members', async (c) => {
    const projectId = c.req.param('projectId');
    const g = guard(c, 'project.describe', { project_id: projectId });
    if ('errorResponse' in g) return g.errorResponse;
    if (!(await projectInOrg(deps.db, projectId, g.user.org_id))) {
      return jsonError(c, 'project.not_found', 'Project not found.');
    }
    const rows = await deps.db
      .select({
        user_id: schema.memberships.user_id,
        email: schema.users.email,
        role: schema.memberships.role,
        granted_at: schema.memberships.granted_at,
      })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.memberships.user_id, schema.users.id))
      .where(eq(schema.memberships.project_id, projectId));
    return c.json({ members: rows });
  });

  r.post('/:projectId/members', async (c) => {
    const projectId = c.req.param('projectId');
    const g = guard(c, 'member.add', { project_id: projectId });
    if ('errorResponse' in g) return g.errorResponse;
    if (!(await projectInOrg(deps.db, projectId, g.user.org_id))) {
      return jsonError(c, 'project.not_found', 'Project not found.');
    }
    const body = await parseBody(c, AddMemberBody, 'Invalid member body.');
    if ('errorResponse' in body) return body.errorResponse;

    const targetRows = await deps.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.email, body.data.email), eq(schema.users.org_id, g.user.org_id)))
      .limit(1);
    const target = targetRows[0];
    if (!target) {
      return jsonError(c, 'user.not_found', `No user with email ${body.data.email} in this org.`);
    }

    const existing = await deps.db
      .select({ user_id: schema.memberships.user_id })
      .from(schema.memberships)
      .where(
        and(
          eq(schema.memberships.user_id, target.id),
          eq(schema.memberships.project_id, projectId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await deps.db
        .update(schema.memberships)
        .set({ role: body.data.role, granted_by: g.user.id, granted_at: new Date().toISOString() })
        .where(
          and(
            eq(schema.memberships.user_id, target.id),
            eq(schema.memberships.project_id, projectId),
          ),
        );
      await audit(c, deps.db, 'member.role_changed', {
        project_id: projectId,
        target_user_id: target.id,
        role: body.data.role,
      });
    } else {
      await deps.db.insert(schema.memberships).values({
        user_id: target.id,
        project_id: projectId,
        role: body.data.role,
        granted_by: g.user.id,
      });
      await audit(c, deps.db, 'member.added', {
        project_id: projectId,
        target_user_id: target.id,
        role: body.data.role,
      });
    }
    return c.json({ user_id: target.id, role: body.data.role }, 201);
  });

  r.patch('/:projectId/members/:userId', async (c) => {
    const projectId = c.req.param('projectId');
    const g = guard(c, 'member.role_change', { project_id: projectId });
    if ('errorResponse' in g) return g.errorResponse;
    if (!(await projectInOrg(deps.db, projectId, g.user.org_id))) {
      return jsonError(c, 'project.not_found', 'Project not found.');
    }
    const targetUserId = c.req.param('userId');
    const body = await parseBody(c, PatchMemberBody, 'Invalid member body.');
    if ('errorResponse' in body) return body.errorResponse;

    const result = await deps.db
      .update(schema.memberships)
      .set({ role: body.data.role, granted_by: g.user.id, granted_at: new Date().toISOString() })
      .where(
        and(
          eq(schema.memberships.user_id, targetUserId),
          eq(schema.memberships.project_id, projectId),
        ),
      )
      .returning();
    if (result.length === 0) {
      return jsonError(c, 'membership.not_found', 'Membership not found.');
    }
    await audit(c, deps.db, 'member.role_changed', {
      project_id: projectId,
      target_user_id: targetUserId,
      role: body.data.role,
    });
    return c.json({ user_id: targetUserId, role: body.data.role });
  });

  r.delete('/:projectId/members/:userId', async (c) => {
    const projectId = c.req.param('projectId');
    const g = guard(c, 'member.remove', { project_id: projectId });
    if ('errorResponse' in g) return g.errorResponse;
    if (!(await projectInOrg(deps.db, projectId, g.user.org_id))) {
      return jsonError(c, 'project.not_found', 'Project not found.');
    }
    const targetUserId = c.req.param('userId');
    const result = await deps.db
      .delete(schema.memberships)
      .where(
        and(
          eq(schema.memberships.user_id, targetUserId),
          eq(schema.memberships.project_id, projectId),
        ),
      )
      .returning();
    if (result.length === 0) {
      return jsonError(c, 'membership.not_found', 'Membership not found.');
    }
    await audit(c, deps.db, 'member.removed', {
      project_id: projectId,
      target_user_id: targetUserId,
    });
    return c.body(null, 204);
  });

  return r;
}
