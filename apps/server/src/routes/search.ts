import { and, desc, eq, inArray, isNull, like, lt, or } from 'drizzle-orm';
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
      return c.json({ results: [], next_cursor: null });
    }

    const limitRaw = Number(c.req.query('limit') ?? 50);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100
        ? Math.floor(limitRaw)
        : 50;
    const beforeCreatedAt = c.req.query('before_created_at') ?? null;

    const searchTerm = `%${q}%`;
    const isOrgAdmin = user.org_role === 'owner' || user.org_role === 'admin';
    const cursorClause = beforeCreatedAt
      ? lt(schema.secrets.created_at, beforeCreatedAt)
      : undefined;
    const matchClause = or(
      like(schema.secrets.key, searchTerm),
      like(schema.environments.name, searchTerm),
      like(schema.projects.name, searchTerm),
    );

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
            matchClause,
            ...(cursorClause ? [cursorClause] : []),
          ),
        )
        .orderBy(desc(schema.secrets.created_at))
        .limit(limit);
    } else {
      const memberProjectIds = user.memberships.map((m) => m.project_id);
      if (memberProjectIds.length === 0) {
        return c.json({ results: [], next_cursor: null });
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
            matchClause,
            ...(cursorClause ? [cursorClause] : []),
          ),
        )
        .orderBy(desc(schema.secrets.created_at))
        .limit(limit);
    }

    const tail = rows.at(-1);
    const next_cursor = tail && rows.length === limit ? tail.created_at : null;
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
      next_cursor,
    });
  });

  return r;
}
