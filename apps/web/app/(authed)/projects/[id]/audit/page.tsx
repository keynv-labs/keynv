import { type AuditEntry, AuditTimeline } from '@/components/audit/audit-timeline';
import { api } from '@/lib/api';

interface AuditResponse {
  entries: AuditEntry[];
  next_cursor: number | null;
}

export default async function ProjectAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event_type?: string; limit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const audit = await api<AuditResponse>('/v1/audit', {
    query: { event_type: sp.event_type, limit: sp.limit ?? 200, project_id: id } as Record<string, string | number | undefined>,
  });

  return (
    <div className="space-y-5">
      <h2 className="display text-lg tracking-tight text-fg">Audit log</h2>
      <AuditTimeline entries={audit.entries} nextCursor={audit.next_cursor} />
    </div>
  );
}
