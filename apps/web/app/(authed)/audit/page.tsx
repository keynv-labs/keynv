import { Breadcrumb } from '@/components/layout/breadcrumb';
import { type AuditEntry, AuditTimeline } from '@/components/audit/audit-timeline';
import { ChainBanner } from '@/components/audit/chain-banner';
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
    <div className="space-y-6">
      <Breadcrumb segments={[{ label: 'Audit log' }]} />

      <header>
        <h1 className="text-[22px] font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-fg-muted mt-1">
          Every operation, hash-chained. Verify integrity any time.
        </p>
      </header>

      <ChainBanner />

      <AuditTimeline entries={audit.entries} />
    </div>
  );
}
