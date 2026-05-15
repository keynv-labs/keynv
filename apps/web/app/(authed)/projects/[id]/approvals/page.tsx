import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { type ApprovalRow, ApprovalsClient } from './_components/approvals-client';

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, page] = await Promise.all([
    getSession(),
    api<{ approvals: ApprovalRow[]; next_cursor: string | null }>(`/v1/projects/${id}/approvals`, {
      query: { limit: 50 },
    }),
  ]);

  // 'approval.grant' RBAC = owner / admin / lead. We do a permissive
  // client-side derivation here (org-level owner/admin always; lead
  // requires per-project membership which the session doesn't carry).
  // The server still enforces; this just hides the UI buttons for
  // users who definitely can't act.
  const orgRole = session?.org_role;
  const canDecide = orgRole === 'owner' || orgRole === 'admin' || orgRole === 'lead';

  return (
    <ApprovalsClient
      projectId={id}
      approvals={page.approvals}
      nextCursor={page.next_cursor}
      canDecide={canDecide}
    />
  );
}
