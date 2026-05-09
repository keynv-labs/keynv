import { authorize } from '@keynv/rbac';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit/append.js';
import { hashPassword } from '../auth/password.js';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';
import { newUserId } from '../lib/id.js';
import { authedChain } from '../lib/middleware-chain.js';

interface UserDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
  org_role: z.enum(['admin', 'developer', 'reader']).default('developer'),
});

const PatchOrgRoleBody = z.object({
  org_role: z.enum(['admin', 'developer', 'reader']),
});

export function userRoutes(deps: UserDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

  r.get('/', async (c) => {
    const user = c.var.user;
    if (user.org_role !== 'owner' && user.org_role !== 'admin') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const rows = await deps.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        org_role: schema.users.org_role,
        created_at: schema.users.created_at,
      })
      .from(schema.users)
      .where(eq(schema.users.org_id, user.org_id));
    return c.json({ users: rows });
  });

  // Phase 1: admin-creates-user (no invite-token flow yet — that's Phase 4).
  r.post('/', async (c) => {
    const user = c.var.user;
    if (authorize('user.invite', { user }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const parsed = CreateUserBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid user body.');

    const existing = await deps.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, parsed.data.email), eq(schema.users.org_id, user.org_id)))
      .limit(1);
    if (existing[0]) {
      return jsonError(c, 'user.already_exists', 'User with this email already exists.');
    }

    const id = newUserId();
    const password_hash = await hashPassword(parsed.data.password);
    await deps.db.insert(schema.users).values({
      id,
      org_id: user.org_id,
      email: parsed.data.email,
      password_hash,
      org_role: parsed.data.org_role,
    });
    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'user.invited',
      payload: { target_user_id: id, email: parsed.data.email, org_role: parsed.data.org_role },
    });
    return c.json({ id, email: parsed.data.email, org_role: parsed.data.org_role }, 201);
  });

  // PATCH /v1/users/:id/org-role  (audit finding M5; docs/06-api-spec.md §69-72)
  r.patch('/:id/org-role', async (c) => {
    const user = c.var.user;
    if (authorize('user.role_change', { user }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const targetId = c.req.param('id');
    if (targetId === user.id) {
      // Refuse self-modification — prevents an admin from accidentally
      // demoting themselves out of admin or promoting to owner.
      return jsonError(c, 'rbac.denied', 'Cannot change your own org role.');
    }
    const parsed = PatchOrgRoleBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid body.');

    const targets = await deps.db
      .select({ id: schema.users.id, org_role: schema.users.org_role })
      .from(schema.users)
      .where(and(eq(schema.users.id, targetId), eq(schema.users.org_id, user.org_id)))
      .limit(1);
    const target = targets[0];
    if (!target) return jsonError(c, 'user.not_found', 'User not found.');
    if (target.org_role === 'owner') {
      // Owner role transitions only via /v1/org/transfer (Phase 6).
      return jsonError(c, 'rbac.denied', 'Owner role cannot be changed via this endpoint.');
    }

    await deps.db
      .update(schema.users)
      .set({ org_role: parsed.data.org_role })
      .where(eq(schema.users.id, targetId));

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'user.role_changed',
      payload: { target_user_id: targetId, org_role: parsed.data.org_role },
    });
    return c.json({ id: targetId, org_role: parsed.data.org_role });
  });

  // DELETE /v1/users/:id  — owner/admin removes a user from the org.
  // Cascade rules in schema drop their memberships + refresh tokens.
  r.delete('/:id', async (c) => {
    const user = c.var.user;
    if (authorize('user.remove', { user }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const targetId = c.req.param('id');
    if (targetId === user.id) {
      return jsonError(c, 'rbac.denied', 'Cannot remove yourself.');
    }
    const targets = await deps.db
      .select({ id: schema.users.id, email: schema.users.email, org_role: schema.users.org_role })
      .from(schema.users)
      .where(and(eq(schema.users.id, targetId), eq(schema.users.org_id, user.org_id)))
      .limit(1);
    const target = targets[0];
    if (!target) return jsonError(c, 'user.not_found', 'User not found.');
    if (target.org_role === 'owner') {
      return jsonError(c, 'rbac.denied', 'Owner cannot be removed via this endpoint.');
    }

    await deps.db.delete(schema.users).where(eq(schema.users.id, targetId));

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'user.removed',
      payload: { target_user_id: targetId, email: target.email },
    });
    return c.body(null, 204);
  });

  return r;
}
