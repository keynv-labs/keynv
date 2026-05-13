'use server';

import { api } from '@/lib/api';
import { clearSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export async function dismissOnboardingAction(): Promise<void> {
  try {
    await api('/v1/onboarding/dismiss', { method: 'POST' });
  } catch {
    // best-effort: localStorage fallback handles the session if this fails
  }
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await api('/v1/auth/logout', {
        method: 'POST',
        body: { refresh_token: session.refresh_token },
      });
    } catch {
      // best-effort
    }
  }
  await clearSession();
  redirect('/login?toast=signed_out');
}

export async function loadMoreAuditAction(cursor: number): Promise<{
  entries: Array<{
    id: number;
    ts: string;
    actor_user_id: string | null;
    actor_agent: string;
    event_type: string;
    payload: Record<string, unknown> | null;
  }>;
  next_cursor: number | null;
}> {
  return api('/v1/audit', { query: { limit: 200, since_id: cursor } });
}
