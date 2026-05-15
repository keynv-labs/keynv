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

export async function switchOrgAction(orgId: string): Promise<void> {
  const { getSession, setSession } = await import('@/lib/session');
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.org_ids?.includes(orgId)) {
    redirect('/dashboard?toast=custom&toastMsg=You+are+not+a+member+of+that+organization.');
  }
  session.active_org_id = orgId;
  await setSession(session);
  redirect('/dashboard');
}

export async function createOrgAction(
  orgName: string,
): Promise<{ org_id?: string; error?: string }> {
  try {
    const result = await api<{ id: string }>('/v1/org', {
      method: 'POST',
      body: { name: orgName },
    });
    const { getSession, setSession } = await import('@/lib/session');
    const session = await getSession();
    if (session) {
      session.active_org_id = result.id;
      if (!session.org_ids) session.org_ids = [];
      if (!session.org_ids.includes(result.id)) session.org_ids.push(result.id);
      await setSession(session);
    }
    return { org_id: result.id };
  } catch (err) {
    return { error: (err as { message?: string }).message || 'Failed to create org.' };
  }
}

export async function loadMoreAuditAction(
  cursor: number,
  projectId?: string,
): Promise<{
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
  return api('/v1/audit', { query: { limit: 20, since_id: cursor, project_id: projectId } });
}

interface ApprovalPage {
  approvals: Array<{
    id: string;
    alias: string;
    status: 'pending' | 'granted' | 'denied' | 'expired';
    reason: string | null;
    requester_user_id: string;
    requester_email: string | null;
    decided_by_user_id: string | null;
    decided_at: string | null;
    expires_at: string | null;
    created_at: string;
    project_id?: string;
    project_name?: string;
  }>;
  next_cursor: string | null;
}

/** Server action: next page of project-level approvals after `cursor` (an ISO created_at). */
export async function loadMoreProjectApprovalsAction(opts: {
  projectId: string;
  beforeCreatedAt: string;
  status?: 'pending' | 'granted' | 'denied' | 'expired';
  limit?: number;
}): Promise<ApprovalPage> {
  return api(`/v1/projects/${opts.projectId}/approvals`, {
    query: {
      before_created_at: opts.beforeCreatedAt,
      limit: opts.limit ?? 100,
      status: opts.status,
    },
  });
}

/** Server action: next page of org-wide approvals after `cursor` (an ISO created_at). */
export async function loadMoreOrgApprovalsAction(opts: {
  beforeCreatedAt: string;
  status?: 'pending' | 'granted' | 'denied' | 'expired';
  limit?: number;
}): Promise<ApprovalPage> {
  return api('/v1/approvals', {
    query: {
      before_created_at: opts.beforeCreatedAt,
      limit: opts.limit ?? 100,
      status: opts.status,
    },
  });
}
