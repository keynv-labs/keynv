import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { authorize } from '@keynv/rbac';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { authMiddleware } from '../auth/middleware.js';
import { hashPassword } from '../auth/password.js';
import { appendAudit } from '../audit/append.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';
import { newUserId } from '../lib/id.js';

interface UserDeps {
  db: Db;
  jwtSecret: string;
}

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
  org_role: z.enum(['admin', 'developer', 'reader']).default('developer'),
});

export function userRoutes(deps: UserDeps): Hono {
  const r = new Hono();
  r.use('*', authMiddleware(() => ({ db: deps.db, jwtSecret: deps.jwtSecret })));

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
      .where(
        and(
          eq(schema.users.email, parsed.data.email),
          eq(schema.users.org_id, user.org_id),
        ),
      )
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

  return r;
}
