import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { authedChain } from '../lib/middleware-chain.js';
import { parseBody } from '../lib/route-utils.js';

interface PreferenceDeps {
  db: Db;
  jwtSecret: string;
  rateLimitPerMinute?: number | undefined;
}

const UpdatePreferencesBody = z.object({
  approval_requests: z.boolean().optional(),
  secret_changes: z.boolean().optional(),
  member_changes: z.boolean().optional(),
  activity_digest: z.enum(['daily', 'weekly', 'never']).optional(),
});

export function preferenceRoutes(deps: PreferenceDeps): Hono {
  const r = new Hono();
  r.use('*', ...authedChain(deps));

  r.get('/', async (c) => {
    const user = c.var.user;
    let prefs = await deps.db
      .select()
      .from(schema.user_preferences)
      .where(eq(schema.user_preferences.user_id, user.id))
      .limit(1)
      .then((r) => r[0]);

    if (!prefs) {
      const now = new Date().toISOString();
      await deps.db.insert(schema.user_preferences).values({
        user_id: user.id,
        updated_at: now,
      });
      prefs = {
        user_id: user.id,
        approval_requests: true,
        secret_changes: true,
        member_changes: true,
        activity_digest: 'daily',
        updated_at: now,
      };
    }

    return c.json({
      approval_requests: prefs.approval_requests,
      secret_changes: prefs.secret_changes,
      member_changes: prefs.member_changes,
      activity_digest: prefs.activity_digest,
    });
  });

  r.patch('/', async (c) => {
    const user = c.var.user;
    const parsed = await parseBody(c, UpdatePreferencesBody, 'Invalid preferences.');
    if ('errorResponse' in parsed) return parsed.errorResponse;
    const body = parsed.data;

    const update: Record<string, unknown> = {};
    if (body.approval_requests !== undefined) update.approval_requests = body.approval_requests;
    if (body.secret_changes !== undefined) update.secret_changes = body.secret_changes;
    if (body.member_changes !== undefined) update.member_changes = body.member_changes;
    if (body.activity_digest !== undefined) update.activity_digest = body.activity_digest;
    update.updated_at = new Date().toISOString();

    await deps.db
      .insert(schema.user_preferences)
      .values({ user_id: user.id, ...update } as typeof schema.user_preferences.$inferInsert)
      .onConflictDoUpdate({
        target: schema.user_preferences.user_id,
        set: update as Record<string, unknown>,
      });

    return c.json({ ok: true });
  });

  return r;
}
