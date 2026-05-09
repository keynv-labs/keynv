import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { type ApprovalRow, ApprovalsClient } from './approvals-client';

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, { approvals }] = await Promise.all([
    getSession(),
    api<{ approvals: ApprovalRow[] }>(`/v1/projects/${id}/approvals`),
  ]);

  // 'approval.grant' RBAC = owner / admin / lead. We do a permissive
  // client-side derivation here (org-level owner/admin always; lead
  // requires per-project membership which the session doesn't carry).
  // The server still enforces; this just hides the UI buttons for
  // users who definitely can't act.
  const orgRole = session?.org_role;
  const canDecide = orgRole === 'owner' || orgRole === 'admin' || orgRole === 'lead';

  return <ApprovalsClient projectId={id} approvals={approvals} canDecide={canDecide} />;
}
