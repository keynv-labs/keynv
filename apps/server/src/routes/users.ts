import { and, desc, eq, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { hashPassword } from '../auth/password.js';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { jsonError } from '../lib/errors.js';
import { newUserId } from '../lib/id.js';
import { authedChain } from '../lib/middleware-chain.js';
import { audit, guard, parseBody } from '../lib/route-utils.js';

interface UserDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
  org_role: z.enum(['admin', 'developer', 'reader']).default('developer'),
  /**
   * Target org. Optional — when omitted, the request's active org
   * (resolved from X-Keynv-Org header) is used. When set, must be one
   * of the inviter's orgs AND the inviter must be owner/admin there.
   */
  org_id: z.string().min(1).optional(),
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
    const params = Object.fromEntries(new URL(c.req.url).searchParams);
    const limitRaw = Number(params.limit ?? 100);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? Math.floor(limitRaw) : 100;
    const beforeCreatedAt =
      typeof params.before_created_at === 'string' ? params.before_created_at : null;

    const conditions = [eq(schema.users.org_id, user.org_id)];
    if (beforeCreatedAt) conditions.push(lt(schema.users.created_at, beforeCreatedAt));

    const rows = await deps.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        org_role: schema.users.org_role,
        created_at: schema.users.created_at,
      })
      .from(schema.users)
      .where(and(...conditions))
      .orderBy(desc(schema.users.created_at))
      .limit(limit);

    const tail = rows.at(-1);
    const next_cursor = tail && rows.length === limit ? tail.created_at : null;
    return c.json({ users: rows, next_cursor });
  });

  // Phase 1: admin-creates-user (no invite-token flow yet — that's Phase 4).
  r.post('/', async (c) => {
    const g = guard(c, 'user.invite');
    if ('errorResponse' in g) return g.errorResponse;
    const user = g.user;
    const parsed = await parseBody(c, CreateUserBody, 'Invalid user body.');
    if ('errorResponse' in parsed) return parsed.errorResponse;

    // Resolve target org. When the body specifies org_id, the inviter
    // must (a) be a member of that org and (b) be owner/admin there —
    // the active-org RBAC check via guard() only proves rights in the
    // *current* active org, not the requested one.
    let targetOrgId = user.org_id;
    if (parsed.data.org_id && parsed.data.org_id !== user.org_id) {
      if (!user.org_ids.includes(parsed.data.org_id)) {
        return jsonError(c, 'rbac.denied', 'You are not a member of that org.');
      }
      const memberRows = await deps.db
        .select({ role: schema.org_memberships.role })
        .from(schema.org_memberships)
        .where(
          and(
            eq(schema.org_memberships.user_id, user.id),
            eq(schema.org_memberships.org_id, parsed.data.org_id),
          ),
        )
        .limit(1);
      const roleThere = memberRows[0]?.role;
      if (roleThere !== 'owner' && roleThere !== 'admin') {
        return jsonError(c, 'rbac.denied', 'Only org admins can invite users.');
      }
      targetOrgId = parsed.data.org_id;
    }

    const existing = await deps.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, parsed.data.email), eq(schema.users.org_id, targetOrgId)))
      .limit(1);
    if (existing[0]) {
      return jsonError(c, 'user.already_exists', 'User with this email already exists.');
    }

    const id = newUserId();
    const password_hash = await hashPassword(parsed.data.password);
    await deps.db.insert(schema.users).values({
      id,
      org_id: targetOrgId,
      email: parsed.data.email,
      password_hash,
      org_role: parsed.data.org_role,
    });
    await audit(c, deps.db, 'user.invited', {
      target_user_id: id,
      email: parsed.data.email,
      org_role: parsed.data.org_role,
      org_id: targetOrgId,
    });
    return c.json(
      { id, email: parsed.data.email, org_role: parsed.data.org_role, org_id: targetOrgId },
      201,
    );
  });

  // PATCH /v1/users/:id/org-role  (audit finding M5; docs/06-api-spec.md §69-72)
  r.patch('/:id/org-role', async (c) => {
    const g = guard(c, 'user.role_change');
    if ('errorResponse' in g) return g.errorResponse;
    const user = g.user;
    const targetId = c.req.param('id');
    if (targetId === user.id) {
      // Refuse self-modification — prevents an admin from accidentally
      // demoting themselves out of admin or promoting to owner.
      return jsonError(c, 'rbac.denied', 'Cannot change your own org role.');
    }
    const parsed = await parseBody(c, PatchOrgRoleBody, 'Invalid body.');
    if ('errorResponse' in parsed) return parsed.errorResponse;

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
      .where(and(eq(schema.users.id, targetId), eq(schema.users.org_id, user.org_id)));

    await audit(c, deps.db, 'user.role_changed', {
      target_user_id: targetId,
      org_role: parsed.data.org_role,
    });
    return c.json({ id: targetId, org_role: parsed.data.org_role });
  });

  // DELETE /v1/users/:id  — owner/admin removes a user from the org.
  // Cascade rules in schema drop their memberships + refresh tokens.
  r.delete('/:id', async (c) => {
    const g = guard(c, 'user.remove');
    if ('errorResponse' in g) return g.errorResponse;
    const user = g.user;
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

    await deps.db
      .delete(schema.users)
      .where(and(eq(schema.users.id, targetId), eq(schema.users.org_id, user.org_id)));

    await audit(c, deps.db, 'user.removed', { target_user_id: targetId, email: target.email });
    return c.body(null, 204);
  });

  return r;
}
