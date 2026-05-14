import { and, eq, inArray, isNull, like, or } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { authedChain } from '../lib/middleware-chain.js';

interface SearchDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

export function searchRoutes(deps: SearchDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

  r.get('/secrets/search', async (c) => {
    const user = c.var.user;
    const q = c.req.query('q')?.trim();
    if (!q || q.length > 100) {
      return c.json({ results: [] });
    }

    const searchTerm = `%${q}%`;
    const isOrgAdmin = user.org_role === 'owner' || user.org_role === 'admin';

    let rows: Array<{
      secret_id: string;
      key: string;
      version: number;
      project_id: string;
      project_name: string;
      env_name: string;
      env_tier: string;
      created_at: string;
    }>;

    if (isOrgAdmin) {
      rows = await deps.db
        .select({
          secret_id: schema.secrets.id,
          key: schema.secrets.key,
          version: schema.secrets.version,
          project_id: schema.projects.id,
          project_name: schema.projects.name,
          env_name: schema.environments.name,
          env_tier: schema.environments.tier,
          created_at: schema.secrets.created_at,
        })
        .from(schema.secrets)
        .innerJoin(schema.environments, eq(schema.secrets.environment_id, schema.environments.id))
        .innerJoin(schema.projects, eq(schema.secrets.project_id, schema.projects.id))
        .where(
          and(
            isNull(schema.secrets.deleted_at),
            isNull(schema.projects.deleted_at),
            eq(schema.projects.org_id, user.org_id),
            or(
              like(schema.secrets.key, searchTerm),
              like(schema.environments.name, searchTerm),
              like(schema.projects.name, searchTerm),
            ),
          ),
        )
        .limit(50);
    } else {
      const memberProjectIds = user.memberships.map((m) => m.project_id);
      if (memberProjectIds.length === 0) {
        return c.json({ results: [] });
      }

      rows = await deps.db
        .select({
          secret_id: schema.secrets.id,
          key: schema.secrets.key,
          version: schema.secrets.version,
          project_id: schema.projects.id,
          project_name: schema.projects.name,
          env_name: schema.environments.name,
          env_tier: schema.environments.tier,
          created_at: schema.secrets.created_at,
        })
        .from(schema.secrets)
        .innerJoin(schema.environments, eq(schema.secrets.environment_id, schema.environments.id))
        .innerJoin(schema.projects, eq(schema.secrets.project_id, schema.projects.id))
        .where(
          and(
            isNull(schema.secrets.deleted_at),
            isNull(schema.projects.deleted_at),
            inArray(schema.projects.id, memberProjectIds),
            or(
              like(schema.secrets.key, searchTerm),
              like(schema.environments.name, searchTerm),
              like(schema.projects.name, searchTerm),
            ),
          ),
        )
        .limit(50);
    }

    return c.json({
      results: rows.map((r) => ({
        secret_id: r.secret_id,
        key: r.key,
        version: r.version,
        project_id: r.project_id,
        project_name: r.project_name,
        env_name: r.env_name,
        env_tier: r.env_tier,
        created_at: r.created_at,
      })),
    });
  });

  return r;
}
