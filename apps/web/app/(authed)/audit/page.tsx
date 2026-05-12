import { type AuditEntry, AuditTimeline } from '@/components/audit/audit-timeline';
import { ChainBanner } from '@/components/audit/chain-banner';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { api } from '@/lib/api';

export default async function GlobalAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ event_type?: string; limit?: string }>;
}) {
  const sp = await searchParams;
  const audit = await api<{ entries: AuditEntry[] }>('/v1/audit', {
    query: { event_type: sp.event_type, limit: sp.limit ?? 200 },
  });

  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Audit log' }]} />

      <PageHeader
        eyebrow="audit · hash-chained"
        title="Audit log"
        description="Every operation, hash-chained. Verify integrity any time."
      />

      <ChainBanner />

      <AuditTimeline entries={audit.entries} />
    </div>
  );
}
