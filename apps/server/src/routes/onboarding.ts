import { and, eq, isNull, sql } from 'drizzle-orm';
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
 * `integration_installed` is derived from whether the user has ever
 * successfully resolved a secret alias (i.e., run `keynv exec`).
 *
 * Dismissal state is stored in `users.onboarding_dismissed_at` so it
 * persists across devices and browsers. A `POST /dismiss` sub-route
 * sets the timestamp; the checklist respects it on next load.
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

    const [readEvent] = await deps.db
      .select({ id: schema.audit.id })
      .from(schema.audit)
      .where(
        and(
          eq(schema.audit.actor_user_id, user.id),
          eq(schema.audit.event_type, 'secret.read.allowed'),
        ),
      )
      .limit(1);
    const integration_installed = Boolean(readEvent);

    const [userRow] = await deps.db
      .select({ onboarding_dismissed_at: schema.users.onboarding_dismissed_at })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1);
    const dismissed = Boolean(userRow?.onboarding_dismissed_at);

    return c.json({
      project_created,
      secret_added,
      cli_authenticated,
      integration_installed,
      dismissed,
    });
  });

  r.post('/dismiss', async (c) => {
    const user = c.var.user;
    await deps.db
      .update(schema.users)
      .set({ onboarding_dismissed_at: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
      .where(eq(schema.users.id, user.id));
    return c.json({ ok: true });
  });

  return r;
}
