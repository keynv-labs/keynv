import { authorize } from '@keynv/rbac';
import { desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit/append.js';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';
import { newOrgId } from '../lib/id.js';
import { authedChain } from '../lib/middleware-chain.js';

interface OrgDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

const UpdateOrgBody = z.object({
  name: z.string().min(1).max(64),
});

const CreateOrgBody = z.object({
  name: z.string().min(1).max(64),
});

export function orgRoutes(deps: OrgDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

  // GET /v1/org  — list orgs the caller belongs to (all of them).
  r.get('/', async (c) => {
    const u = c.var.user;
    const rows = await deps.db
      .select({ id: schema.orgs.id, name: schema.orgs.name, created_at: schema.orgs.created_at })
      .from(schema.orgs)
      .where(inArray(schema.orgs.id, u.org_ids))
      .orderBy(desc(schema.orgs.created_at));
    return c.json({ orgs: rows });
  });

  // POST /v1/org  — create a new org and add the caller as owner.
  r.post('/', async (c) => {
    const u = c.var.user;
    const parsed = CreateOrgBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(c, 'validation.failed', 'Org name is required (1-64 chars).');
    }

    const orgId = newOrgId();
    deps.db.transaction((tx) => {
      tx.insert(schema.orgs).values({ id: orgId, name: parsed.data.name }).run();
      tx.insert(schema.org_memberships)
        .values({ user_id: u.id, org_id: orgId, role: 'owner' })
        .run();
    });

    await appendAudit(deps.db, {
      actor_user_id: u.id,
      actor_agent: readAgent(c),
      event_type: 'org.updated',
      payload: { org_id: orgId, name: parsed.data.name },
    });

    return c.json({ id: orgId, name: parsed.data.name }, 201);
  });

  // PATCH /v1/org  — rename the caller's organization.
  r.patch('/', async (c) => {
    const user = c.var.user;
    if (authorize('org.update', { user }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const parsed = UpdateOrgBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(c, 'validation.failed', 'Invalid org body.');
    }

    await deps.db
      .update(schema.orgs)
      .set({ name: parsed.data.name })
      .where(eq(schema.orgs.id, user.org_id));

    await appendAudit(deps.db, {
      actor_user_id: user.id,
      actor_agent: readAgent(c),
      event_type: 'org.updated',
      payload: { org_id: user.org_id, name: parsed.data.name },
    });

    return c.json({ id: user.org_id, name: parsed.data.name });
  });

  return r;
}
