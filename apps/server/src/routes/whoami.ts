import { eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { authedChain } from '../lib/middleware-chain.js';

interface WhoamiDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

export function whoamiRoute(deps: WhoamiDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));
  r.get('/', async (c) => {
    const u = c.var.user;
    const { db } = deps;

    // Active org info.
    const orgRows = await db
      .select({ name: schema.orgs.name })
      .from(schema.orgs)
      .where(eq(schema.orgs.id, u.org_id))
      .limit(1);
    const active_org_name = orgRows[0]?.name ?? u.org_id;

    // All orgs the user belongs to — query DB directly so newly created
    // orgs appear immediately without requiring a re-login (JWT org_ids
    // is stale until the next token refresh).
    const allOrgRows = await db
      .select({ id: schema.orgs.id, name: schema.orgs.name })
      .from(schema.org_memberships)
      .innerJoin(schema.orgs, eq(schema.orgs.id, schema.org_memberships.org_id))
      .where(eq(schema.org_memberships.user_id, u.id));
    const orgs = allOrgRows.length > 0
      ? allOrgRows.map((o) => ({ id: o.id, name: o.name }))
      : [{ id: u.org_id, name: active_org_name }];

    let memberships: Array<{ project_id: string; project_name: string; role: string }> = [];
    if (u.memberships.length > 0) {
      const projectIds = u.memberships.map((m) => m.project_id);
      const projectRows = await db
        .select({ id: schema.projects.id, name: schema.projects.name })
        .from(schema.projects)
        .where(inArray(schema.projects.id, projectIds));
      const nameById = new Map(projectRows.map((p) => [p.id, p.name]));
      memberships = u.memberships.map((m) => ({
        project_id: m.project_id,
        project_name: nameById.get(m.project_id) ?? m.project_id,
        role: m.role,
      }));
    }

    return c.json({
      id: u.id,
      email: u.email,
      org_id: u.org_id,
      org_name: active_org_name,
      org_role: u.org_role,
      orgs,
      memberships,
    });
  });
  return r;
}
