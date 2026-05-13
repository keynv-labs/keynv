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

    const orgRows = await db
      .select({ name: schema.orgs.name })
      .from(schema.orgs)
      .where(eq(schema.orgs.id, u.org_id))
      .limit(1);
    const org_name = orgRows[0]?.name ?? u.org_id;

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
      org_name,
      org_role: u.org_role,
      memberships,
    });
  });
  return r;
}
