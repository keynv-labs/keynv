import { audit as auditCore } from '@keynv/core';
import { authorize } from '@keynv/rbac';
import { Hono } from 'hono';
import { z } from 'zod';
import { listAudit } from '../audit/append.js';
import type { Db } from '../db/index.js';
import { jsonError } from '../lib/errors.js';
import { authedChain } from '../lib/middleware-chain.js';

interface AuditDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

const ListQuery = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  since_id: z.coerce.number().int().nonnegative().optional(),
  event_type: z.string().min(1).max(64).optional(),
});

export function auditRoutes(deps: AuditDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

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
    // Walk the chain in pages of 1000. Thread the previous page's
    // tail hash into each subsequent verify so the cross-page
    // boundary is checked — without this, verification would falsely
    // report prev_hash_mismatch on every chain longer than one page
    // (audit finding B1).
    let cursor: number | undefined;
    let total = 0;
    let lastTailHash: string | undefined;
    for (;;) {
      const page = await listAudit(deps.db, { limit: 1000, sinceId: cursor });
      if (page.length === 0) break;
      const result = auditCore.verifyChain(
        page,
        lastTailHash ? { startingPrevHash: lastTailHash } : {},
      );
      if (!result.ok) {
        return c.json({
          ok: false,
          broken_at_id: page[result.brokenAt ?? 0]?.id,
          reason: result.reason,
          checked: total + (result.brokenAt ?? 0),
        });
      }
      total += page.length;
      const tail = page.at(-1);
      if (!tail) break;
      cursor = tail.id;
      lastTailHash = tail.hash;
    }
    return c.json({ ok: true, checked: total });
  });

  return r;
}
