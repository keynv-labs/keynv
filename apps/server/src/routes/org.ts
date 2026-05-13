import { authorize } from '@keynv/rbac';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit/append.js';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { readAgent } from '../lib/agent.js';
import { jsonError } from '../lib/errors.js';
import { authedChain } from '../lib/middleware-chain.js';

interface OrgDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

const UpdateOrgBody = z.object({
  name: z.string().min(1).max(64),
});

export function orgRoutes(deps: OrgDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

  // PATCH /v1/org  — rename the caller's organization.
  // Only owner and admin roles may rename the org.
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
