import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import Link from 'next/link';
import { VerifyChainButton } from './verify-button';

interface AuditEntry {
  id: number;
  ts: string;
  actor_user_id: string | null;
  actor_agent: string;
  event_type: string;
  payload: Record<string, unknown>;
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
  const project = await api<{ name: string }>(`/v1/projects/${id}`);
  const audit = await api<{ entries: AuditEntry[] }>('/v1/audit', {
    query: { event_type: sp.event_type, limit: sp.limit ?? 200 },
  });

  // Best-effort filter on payload.project_id; the server-wide audit
  // doesn't index per-project today (Phase 5 hardening).
  const entries = audit.entries.filter(
    (e) =>
      !e.payload ||
      (e.payload as { project_id?: string }).project_id === undefined ||
      (e.payload as { project_id: string }).project_id === id,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={{ pathname: `/projects/${id}` }}
            className="text-xs text-[var(--color-fg-muted)]"
          >
            ← {project.name}
          </Link>
          <h1 className="text-xl font-semibold mt-1">Audit log</h1>
        </div>
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
            {entries.map((e) => (
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
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)] text-center py-6">
            No audit entries match this filter.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
