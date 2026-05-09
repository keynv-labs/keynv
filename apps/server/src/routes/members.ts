import { authorize } from '@keynv/rbac';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit/append.js';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';
import { authedChain } from '../lib/middleware-chain.js';

interface MemberDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

/**
 * Returns true if `projectId` exists in `orgId` and is not deleted.
 * Used by every member-* route to guard against cross-org access
 * (audit finding B2). Routes return 404 on false to avoid leaking
 * project existence across orgs.
 */
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
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    if (authorize('project.describe', { user, resource: { project_id: projectId } }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    if (!(await projectInOrg(deps.db, projectId, user.org_id))) {
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
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    if (authorize('member.add', { user, resource: { project_id: projectId } }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    if (!(await projectInOrg(deps.db, projectId, user.org_id))) {
      return jsonError(c, 'project.not_found', 'Project not found.');
    }
    const parsed = AddMemberBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid member body.');

    const targetRows = await deps.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.email, parsed.data.email), eq(schema.users.org_id, user.org_id)))
      .limit(1);
    const target = targetRows[0];
    if (!target) {
      return jsonError(c, 'user.not_found', `No user with email ${parsed.data.email} in this org.`);
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
        .set({ role: parsed.data.role, granted_by: user.id, granted_at: new Date().toISOString() })
        .where(
          and(
            eq(schema.memberships.user_id, target.id),
            eq(schema.memberships.project_id, projectId),
          ),
        );
      await appendAudit(deps.db, {
        actor_user_id: user.id,
        actor_agent: readAgent(c),
        event_type: 'member.role_changed',
        payload: { project_id: projectId, target_user_id: target.id, role: parsed.data.role },
      });
    } else {
      await deps.db.insert(schema.memberships).values({
        user_id: target.id,
        project_id: projectId,
        role: parsed.data.role,
        granted_by: user.id,
      });
      await appendAudit(deps.db, {
        actor_user_id: user.id,
        actor_agent: readAgent(c),
        event_type: 'member.added',
        payload: { project_id: projectId, target_user_id: target.id, role: parsed.data.role },
      });
    }
    return c.json({ user_id: target.id, role: parsed.data.role }, 201);
  });

  r.patch('/:projectId/members/:userId', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    if (
      authorize('member.role_change', { user, resource: { project_id: projectId } }) !== 'allow'
    ) {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    if (!(await projectInOrg(deps.db, projectId, user.org_id))) {
      return jsonError(c, 'project.not_found', 'Project not found.');
    }
    const targetUserId = c.req.param('userId');
    const parsed = PatchMemberBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid member body.');

    const result = await deps.db
      .update(schema.memberships)
      .set({ role: parsed.data.role, granted_by: user.id, granted_at: new Date().toISOString() })
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
    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'member.role_changed',
      payload: { project_id: projectId, target_user_id: targetUserId, role: parsed.data.role },
    });
    return c.json({ user_id: targetUserId, role: parsed.data.role });
  });

  r.delete('/:projectId/members/:userId', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    if (authorize('member.remove', { user, resource: { project_id: projectId } }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    if (!(await projectInOrg(deps.db, projectId, user.org_id))) {
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
    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'member.removed',
      payload: { project_id: projectId, target_user_id: targetUserId },
    });
    return c.body(null, 204);
  });

  return r;
}
