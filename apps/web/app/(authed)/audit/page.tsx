import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { VerifyChainButton } from '../projects/[id]/audit/verify-button';

interface AuditEntry {
  id: number;
  ts: string;
  actor_user_id: string | null;
  actor_agent: string;
  event_type: string;
  payload: Record<string, unknown>;
}

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Audit log</h1>
        <VerifyChainButton />
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--color-fg-muted)]">
            <tr>
              <th className="pb-2">When</th>
              <th className="pb-2">Actor</th>
              <th className="pb-2">Agent</th>
              <th className="pb-2">Event</th>
              <th className="pb-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {audit.entries.map((e) => (
              <tr key={e.id} className="border-t border-[var(--color-border)] align-top">
                <td className="py-2 text-[var(--color-fg-muted)] whitespace-nowrap">
                  {new Date(e.ts).toLocaleString()}
                </td>
                <td className="py-2 mono">{e.actor_user_id ?? '—'}</td>
                <td className="py-2 mono">{e.actor_agent}</td>
                <td className="py-2 mono">{e.event_type}</td>
                <td className="py-2 mono text-xs text-[var(--color-fg-muted)]">
                  {JSON.stringify(e.payload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {audit.entries.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)] text-center py-6">
            No audit entries.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
