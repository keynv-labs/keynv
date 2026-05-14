import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { type ApprovalRow, InboxClient } from './_components/inbox-client';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await getSession();
  const { approvals, next_cursor } = await api<{
    approvals: ApprovalRow[];
    next_cursor: string | null;
  }>('/v1/approvals', { query: { limit: 50 } }).catch(() => ({
    approvals: [] as ApprovalRow[],
    next_cursor: null,
  }));

  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Inbox' }]} />

      <PageHeader
        eyebrow="inbox · cross-project approvals"
        title="Approvals inbox"
        description="Every pending production-access approval across your organization, in one queue. Decisions still happen inside the project."
      />

      <InboxClient
        initialApprovals={approvals}
        initialCursor={next_cursor}
        myUserId={session?.user_id ?? ''}
      />
    </div>
  );
}
