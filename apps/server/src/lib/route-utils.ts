import { type Action, authorize } from '@keynv/rbac';
import type { Context } from 'hono';
import type { z } from 'zod';
import { type AppendArgs, appendAudit } from '../audit/append.js';
import type { AuthedUser } from '../auth/middleware.js';
import { readAgent } from './agent.js';
import { jsonError } from './errors.js';
import { recordAuditDomainEvents } from './metrics.js';

export async function parseBody<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
  message: string,
): Promise<{ data: z.output<T> } | { errorResponse: Response }> {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { errorResponse: jsonError(c, 'validation.failed', message) };
  return { data: parsed.data };
}

export function guard(
  c: Context,
  action: Action,
  resource?: {
    project_id?: string;
    environment_tier?: 'production' | 'non-production';
    require_approval?: boolean;
  },
): { user: AuthedUser } | { errorResponse: Response } {
  const user = c.var.user;
  if (!user) return { errorResponse: jsonError(c, 'auth.missing_token', 'Not authenticated.') };
  const decision = authorize(action, { user, ...(resource ? { resource } : {}) });
  if (decision !== 'allow')
    return { errorResponse: jsonError(c, 'rbac.denied', 'Permission denied.') };
  return { user };
}

export async function audit(
  c: Context,
  db: Parameters<typeof appendAudit>[0],
  event_type: AppendArgs['event_type'],
  payload: Record<string, unknown>,
): Promise<void> {
  const user = c.var.user;
  await appendAudit(db, {
    actor_user_id: user?.id ?? null,
    actor_agent: readAgent(c),
    event_type,
    payload,
  });
  recordAuditDomainEvents(c, event_type);
}
