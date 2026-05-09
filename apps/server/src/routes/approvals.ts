import { authorize } from '@keynv/rbac';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit/append.js';
import { authMiddleware } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';
import { newApprovalId } from '../lib/id.js';

interface ApprovalDeps {
  db: Db;
  jwtSecret: string;
}

const ListQuery = z.object({
  status: z.enum(['pending', 'granted', 'denied', 'expired']).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

const GrantBody = z.object({
  expires_in_seconds: z.coerce
    .number()
    .int()
    .positive()
    .max(7 * 24 * 3600)
    .optional(),
  reason: z.string().max(500).optional(),
});

const DenyBody = z.object({
  reason: z.string().min(1).max(500),
});

const DEFAULT_GRANT_TTL_S = 60 * 60; // 1 hour

export function approvalRoutes(deps: ApprovalDeps): Hono {
  const r = new Hono();
  r.use(
    '*',
    authMiddleware(() => ({ db: deps.db, jwtSecret: deps.jwtSecret })),
  );

  /**
   * GET /v1/projects/:projectId/approvals?status=pending&limit=100
   *
   * Anyone with project visibility (project.describe) can list — a
   * developer wants to see whether their own pending request is still
   * pending, and a lead/admin wants to see what's queued for them to
   * decide. We return the joined requester / decider emails so the UI
   * doesn't have to round-trip /v1/users.
   */
  r.get('/:projectId/approvals', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');

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

    const decision = authorize('project.describe', {
      user,
      resource: { project_id: projectId },
    });
    if (decision !== 'allow') return jsonError(c, 'rbac.denied', 'Permission denied.');

    const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid query.');

    const requester = { id: schema.users.id, email: schema.users.email };
    const rows = await deps.db
      .select({
        id: schema.approvals.id,
        alias: schema.approvals.alias,
        status: schema.approvals.status,
        reason: schema.approvals.reason,
        requester_user_id: schema.approvals.requester_user_id,
        requester_email: requester.email,
        decided_by_user_id: schema.approvals.decided_by_user_id,
        decided_at: schema.approvals.decided_at,
        expires_at: schema.approvals.expires_at,
        created_at: schema.approvals.created_at,
      })
      .from(schema.approvals)
      .leftJoin(schema.users, eq(schema.users.id, schema.approvals.requester_user_id))
      .where(
        parsed.data.status
          ? and(
              eq(schema.approvals.project_id, projectId),
              eq(schema.approvals.status, parsed.data.status),
            )
          : eq(schema.approvals.project_id, projectId),
      )
      .orderBy(desc(schema.approvals.created_at))
      .limit(parsed.data.limit);

    return c.json({ approvals: rows });
  });

  /**
   * POST /v1/projects/:projectId/approvals/:id/grant
   *
   * Lead / admin / owner approves a pending request. Sets status,
   * decided_by, decided_at, expires_at (default +1h, max +7d).
   */
  r.post('/:projectId/approvals/:id/grant', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    const approvalId = c.req.param('id');

    const project = await loadProject(deps.db, projectId, user.org_id);
    if (!project) return jsonError(c, 'project.not_found', 'Project not found.');

    if (
      authorize('approval.grant', { user, resource: { project_id: projectId } }) !== 'allow'
    ) {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }

    const parsed = GrantBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid body.');

    const ttl = parsed.data.expires_in_seconds ?? DEFAULT_GRANT_TTL_S;
    const expires_at = new Date(Date.now() + ttl * 1000).toISOString();
    const decided_at = new Date().toISOString();

    const updated = await deps.db
      .update(schema.approvals)
      .set({
        status: 'granted',
        decided_by_user_id: user.id,
        decided_at,
        expires_at,
        reason: parsed.data.reason ?? null,
      })
      .where(
        and(
          eq(schema.approvals.id, approvalId),
          eq(schema.approvals.project_id, projectId),
          eq(schema.approvals.status, 'pending'),
        ),
      )
      .returning({
        id: schema.approvals.id,
        alias: schema.approvals.alias,
      });
    const row = updated[0];
    if (!row) return jsonError(c, 'approval.not_found', 'Approval not found or already decided.');

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'approval.granted',
      payload: { alias: row.alias, granted_by: user.id },
    });

    return c.json({ id: row.id, alias: row.alias, status: 'granted', expires_at });
  });

  /**
   * POST /v1/projects/:projectId/approvals/:id/deny
   *
   * Lead / admin / owner denies a pending request, with a required
   * reason that lands in the audit chain.
   */
  r.post('/:projectId/approvals/:id/deny', async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('projectId');
    const approvalId = c.req.param('id');

    const project = await loadProject(deps.db, projectId, user.org_id);
    if (!project) return jsonError(c, 'project.not_found', 'Project not found.');

    if (
      authorize('approval.grant', { user, resource: { project_id: projectId } }) !== 'allow'
    ) {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }

    const parsed = DenyBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(c, 'validation.failed', 'Invalid body — reason is required.');
    }

    const decided_at = new Date().toISOString();
    const updated = await deps.db
      .update(schema.approvals)
      .set({
        status: 'denied',
        decided_by_user_id: user.id,
        decided_at,
        reason: parsed.data.reason,
      })
      .where(
        and(
          eq(schema.approvals.id, approvalId),
          eq(schema.approvals.project_id, projectId),
          eq(schema.approvals.status, 'pending'),
        ),
      )
      .returning({
        id: schema.approvals.id,
        alias: schema.approvals.alias,
      });
    const row = updated[0];
    if (!row) return jsonError(c, 'approval.not_found', 'Approval not found or already decided.');

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'approval.denied',
      payload: { alias: row.alias, denied_by: user.id },
    });

    return c.json({ id: row.id, alias: row.alias, status: 'denied' });
  });

  return r;
}

async function loadProject(
  db: Db,
  projectId: string,
  orgId: string,
): Promise<{ id: string } | null> {
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
  return rows[0] ?? null;
}

/**
 * Looks for a granted, non-expired approval row matching this alias +
 * requester. Used by GET /secrets to bypass the pending_approval
 * branch when the lead has already pre-authorised the read.
 *
 * Exported so the secrets route can reuse the same query shape. We
 * also touch the row's status to 'expired' if found-but-expired so
 * the next listing reflects reality.
 */
export async function findActiveGrant(args: {
  db: Db;
  projectId: string;
  alias: string;
  requesterUserId: string;
}): Promise<{ id: string } | null> {
  const candidates = await args.db
    .select({
      id: schema.approvals.id,
      expires_at: schema.approvals.expires_at,
    })
    .from(schema.approvals)
    .where(
      and(
        eq(schema.approvals.project_id, args.projectId),
        eq(schema.approvals.alias, args.alias),
        eq(schema.approvals.requester_user_id, args.requesterUserId),
        eq(schema.approvals.status, 'granted'),
      ),
    )
    .orderBy(desc(schema.approvals.created_at))
    .limit(1);
  const row = candidates[0];
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    // Mark expired so the next listing doesn't show it as still active.
    await args.db
      .update(schema.approvals)
      .set({ status: 'expired' })
      .where(eq(schema.approvals.id, row.id));
    return null;
  }
  return { id: row.id };
}

/**
 * Inserts a pending approval row for this alias + requester if there
 * isn't already one. Returns the pre-existing or newly-created row id.
 * Idempotent — repeated reads from the same developer don't create
 * duplicate pending rows in the lead's queue.
 */
export async function ensurePendingApproval(args: {
  db: Db;
  projectId: string;
  alias: string;
  requesterUserId: string;
}): Promise<{ id: string; created: boolean }> {
  const existing = await args.db
    .select({ id: schema.approvals.id })
    .from(schema.approvals)
    .where(
      and(
        eq(schema.approvals.project_id, args.projectId),
        eq(schema.approvals.alias, args.alias),
        eq(schema.approvals.requester_user_id, args.requesterUserId),
        eq(schema.approvals.status, 'pending'),
      ),
    )
    .limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };

  const id = newApprovalId();
  await args.db.insert(schema.approvals).values({
    id,
    project_id: args.projectId,
    alias: args.alias,
    requester_user_id: args.requesterUserId,
    status: 'pending',
  });
  return { id, created: true };
}
