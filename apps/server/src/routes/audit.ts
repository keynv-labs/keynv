import { Hono } from 'hono';
import { z } from 'zod';
import { audit as auditCore } from '@keynv/core';
import { authorize } from '@keynv/rbac';
import type { Db } from '../db/index.js';
import { authMiddleware } from '../auth/middleware.js';
import { listAudit } from '../audit/append.js';
import { jsonError } from '../lib/errors.js';

interface AuditDeps {
  db: Db;
  jwtSecret: string;
}

const ListQuery = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  since_id: z.coerce.number().int().nonnegative().optional(),
  event_type: z.string().min(1).max(64).optional(),
});

export function auditRoutes(deps: AuditDeps): Hono {
  const r = new Hono();
  r.use('*', authMiddleware(() => ({ db: deps.db, jwtSecret: deps.jwtSecret })));

  r.get('/', async (c) => {
    const user = c.var.user;
    if (authorize('audit.read', { user }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) return jsonError(c, 'validation.failed', 'Invalid query.');
    const entries = await listAudit(deps.db, {
      limit: parsed.data.limit,
      sinceId: parsed.data.since_id,
      eventType: parsed.data.event_type,
    });
    const lastId = entries.at(-1)?.id;
    return c.json({
      entries,
      next_cursor: entries.length > 0 && lastId ? lastId : null,
    });
  });

  r.post('/verify', async (c) => {
    const user = c.var.user;
    if (authorize('audit.read', { user }) !== 'allow') {
      return jsonError(c, 'rbac.denied', 'Permission denied.');
    }
    // Walk the chain in pages of 1000.
    let cursor: number | undefined;
    let total = 0;
    for (;;) {
      const page = await listAudit(deps.db, { limit: 1000, sinceId: cursor });
      if (page.length === 0) break;
      const result = auditCore.verifyChain(page);
      if (!result.ok) {
        return c.json({
          ok: false,
          broken_at_id: page[result.brokenAt ?? 0]?.id,
          reason: result.reason,
          checked: total + (result.brokenAt ?? 0),
        });
      }
      total += page.length;
      const lastId = page.at(-1)?.id;
      if (!lastId) break;
      cursor = lastId;
    }
    return c.json({ ok: true, checked: total });
  });

  return r;
}
