import { type AuditEntry, AuditTimeline } from '@/components/audit/audit-timeline';
import { ChainBanner } from '@/components/audit/chain-banner';
import { api } from '@/lib/api';

export default async function ProjectAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event_type?: string; limit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const audit = await api<{ entries: AuditEntry[] }>('/v1/audit', {
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

  return (
    <div className="space-y-5">
      <ChainBanner />
      <AuditTimeline entries={entries} />
    </div>
  );
}
