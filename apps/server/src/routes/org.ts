import { desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { newOrgId } from '../lib/id.js';
import { authedChain } from '../lib/middleware-chain.js';
import { parseBody, guard, audit } from '../lib/route-utils.js';

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
    const parsed = await parseBody(c, CreateOrgBody, 'Org name is required (1-64 chars).');
    if ('errorResponse' in parsed) return parsed.errorResponse;

    const orgId = newOrgId();
    deps.db.transaction((tx) => {
      tx.insert(schema.orgs).values({ id: orgId, name: parsed.data.name }).run();
      tx.insert(schema.org_memberships)
        .values({ user_id: u.id, org_id: orgId, role: 'owner' })
        .run();
    });

    await audit(c, deps.db, 'org.updated', { org_id: orgId, name: parsed.data.name });

    return c.json({ id: orgId, name: parsed.data.name }, 201);
  });

  // PATCH /v1/org  — rename the caller's organization.
  r.patch('/', async (c) => {
    const g = guard(c, 'org.update');
    if ('errorResponse' in g) return g.errorResponse;
    const user = g.user;
    const parsed = await parseBody(c, UpdateOrgBody, 'Invalid org body.');
    if ('errorResponse' in parsed) return parsed.errorResponse;

    await deps.db
      .update(schema.orgs)
      .set({ name: parsed.data.name })
      .where(eq(schema.orgs.id, user.org_id));

    await audit(c, deps.db, 'org.updated', { org_id: user.org_id, name: parsed.data.name });

    return c.json({ id: user.org_id, name: parsed.data.name });
  });

  return r;
}
