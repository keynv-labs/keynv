import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { authedChain } from '../lib/middleware-chain.js';

interface OnboardingDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

/**
 * GET /v1/onboarding/status
 *
 * Derived from existing rows — no dedicated onboarding tables. Returns
 * a small boolean map the web dashboard uses to render its post-register
 * checklist. Checks scope to the caller's org (project + secret) and
 * the caller's own user (cli tokens) so a teammate's progress doesn't
 * silently mark steps complete for someone else who hasn't done them.
 *
 * `integration_installed` is no longer tracked — `keynv init` replaces the
 * per-agent installers. The web client skips the install CTA when
 * `.keynv.env` exists in the project root.
 *
 * Dismissal state is NOT tracked here — kept in browser localStorage
 * for the v1 (per-device, lightweight). Move to a `users.
 * onboarding_dismissed_at` column when we want cross-device sticky
 * dismissal.
 */
export function onboardingRoutes(deps: OnboardingDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

  r.get('/status', async (c) => {
    const user = c.var.user;

    const [project] = await deps.db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(and(eq(schema.projects.org_id, user.org_id), isNull(schema.projects.deleted_at)))
      .limit(1);
    const project_created = Boolean(project);

    let secret_added = false;
    if (project_created) {
      const [secret] = await deps.db
        .select({ id: schema.secrets.id })
        .from(schema.secrets)
        .innerJoin(schema.projects, eq(schema.secrets.project_id, schema.projects.id))
        .where(and(eq(schema.projects.org_id, user.org_id), isNull(schema.secrets.deleted_at)))
        .limit(1);
      secret_added = Boolean(secret);
    }

    const [token] = await deps.db
      .select({ id: schema.cli_tokens.id })
      .from(schema.cli_tokens)
      .where(and(eq(schema.cli_tokens.user_id, user.id), isNull(schema.cli_tokens.revoked_at)))
      .limit(1);
    const cli_authenticated = Boolean(token);

    return c.json({
      project_created,
      secret_added,
      cli_authenticated,
      integration_installed: false,
    });
  });

  return r;
}
