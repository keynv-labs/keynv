import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { authedChain } from '../lib/middleware-chain.js';

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
    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdatePreferencesBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid preferences.' }, 400);
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.approval_requests !== undefined) update.approval_requests = parsed.data.approval_requests;
    if (parsed.data.secret_changes !== undefined) update.secret_changes = parsed.data.secret_changes;
    if (parsed.data.member_changes !== undefined) update.member_changes = parsed.data.member_changes;
    if (parsed.data.activity_digest !== undefined) update.activity_digest = parsed.data.activity_digest;
    update.updated_at = new Date().toISOString();

    await deps.db
      .insert(schema.user_preferences)
      .values({ user_id: user.id, ...update } as typeof schema.user_preferences.$inferInsert)
      .onConflictDoUpdate({ target: schema.user_preferences.user_id, set: update as Record<string, unknown> });

    return c.json({ ok: true });
  });

  return r;
}
