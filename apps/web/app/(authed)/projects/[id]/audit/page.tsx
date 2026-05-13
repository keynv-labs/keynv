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
    query: { event_type: sp.event_type, limit: sp.limit ?? 200 },
  });

  // Best-effort filter to project scope. The org-wide audit endpoint
  // doesn't index by project_id today (Phase 5 hardening will add a
  // dedicated endpoint); for now we filter client-side after fetching
  // and accept that wide audit windows may miss entries past the limit.
  const entries = audit.entries.filter(
    (e) =>
      !e.payload ||
      (e.payload as { project_id?: string }).project_id === undefined ||
      (e.payload as { project_id?: string }).project_id === id,
  );
  // Cursor-based pagination is page-wide; client-side project filter
  // means load-more may show entries from other projects. Acceptable
  // until a dedicated project-scoped endpoint lands.
  const nextCursor = entries.length > 0 && audit.next_cursor ? audit.next_cursor : null;

  return (
    <div className="space-y-5">
      <h2 className="display text-lg tracking-tight text-fg">Audit log</h2>
      <AuditTimeline entries={entries} nextCursor={nextCursor} />
    </div>
  );
}
