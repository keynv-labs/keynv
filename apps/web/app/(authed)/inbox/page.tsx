import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader, SectionHeader, StatCard } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { ArrowUpRight, Inbox as InboxIcon } from 'lucide-react';
import Link from 'next/link';

interface ProjectListItem {
  id: string;
  name: string;
}

interface ApprovalRow {
  id: string;
  alias: string;
  status: 'pending' | 'granted' | 'denied' | 'expired';
  reason: string | null;
  requester_user_id: string;
  requester_email: string | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface AggregatedApproval extends ApprovalRow {
  project_id: string;
  project_name: string;
}

function relative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatExpiresIn(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = ts - Date.now();
  if (diff <= 0) return 'expired';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

async function loadAll(): Promise<{
  projects: ProjectListItem[];
  approvals: AggregatedApproval[];
}> {
  const { projects } = await api<{ projects: ProjectListItem[] }>('/v1/projects');
  const buckets = await Promise.all(
    projects.map(async (p) => {
      const { approvals } = await api<{ approvals: ApprovalRow[] }>(
        `/v1/projects/${p.id}/approvals`,
      ).catch(() => ({ approvals: [] as ApprovalRow[] }));
      return approvals.map<AggregatedApproval>((a) => ({
        ...a,
        project_id: p.id,
        project_name: p.name,
      }));
    }),
  );
  return { projects, approvals: buckets.flat() };
}

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await getSession();
  const { approvals } = await loadAll();

  const myUserId = session?.user_id ?? '';
  const pending = approvals.filter((a) => a.status === 'pending');
  const toReview = pending.filter((a) => a.requester_user_id !== myUserId);
  const myRequests = pending.filter((a) => a.requester_user_id === myUserId);
  const recentlyDecided = approvals
    .filter((a) => a.status !== 'pending')
    .sort(
      (a, b) => Date.parse(b.decided_at ?? b.created_at) - Date.parse(a.decided_at ?? a.created_at),
    )
    .slice(0, 10);

  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Inbox' }]} />

      <PageHeader
        eyebrow="inbox · cross-project approvals"
        title="Approvals inbox"
        description="Every pending production-access approval across your organization, in one queue. Decisions still happen inside the project."
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="To review"
          value={toReview.length.toLocaleString()}
          hint={toReview.length === 0 ? 'queue is clear' : 'awaiting your decision'}
        />
        <StatCard
          label="Your requests"
          value={myRequests.length.toLocaleString()}
          hint={myRequests.length === 0 ? 'nothing pending' : 'waiting for a decision'}
        />
        <StatCard
          label="Pending total"
          value={pending.length.toLocaleString()}
          hint="across all projects"
        />
        <StatCard
          label="Recently decided"
          value={recentlyDecided.length.toLocaleString()}
          hint="last 10 actions"
        />
      </section>

      {/* ─── To review ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="to review"
          count={toReview.length}
          actions={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">
              · grants production access
            </span>
          }
        />
        {toReview.length === 0 ? (
          <EmptyQueue label="No approvals waiting on you." />
        ) : (
          <ApprovalList rows={toReview} cta="Review" />
        )}
      </section>

      {/* ─── Your requests ───────────────────────────────────────────────── */}
      {myRequests.length > 0 ? (
        <section>
          <SectionHeader title="your requests" count={myRequests.length} />
          <ApprovalList rows={myRequests} cta="Open" />
        </section>
      ) : null}

      {/* ─── Recently decided ────────────────────────────────────────────── */}
      {recentlyDecided.length > 0 ? (
        <section>
          <SectionHeader title="recently decided" count={recentlyDecided.length} />
          <ApprovalList rows={recentlyDecided} cta="Open" />
        </section>
      ) : null}
    </div>
  );
}

function ApprovalList({ rows, cta }: { rows: AggregatedApproval[]; cta: string }) {
  return (
    <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
      {rows.map((a) => (
        <li
          key={a.id}
          className="flex items-start gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
        >
          <Badge tone={statusTone(a.status)}>{a.status}</Badge>

          <div className="flex-1 min-w-0">
            <div className="font-mono text-[13px] text-fg break-all tabular">
              <span className="text-accent">@</span>
              {a.alias.replace(/^@/, '')}
            </div>
            <div className="text-[11px] text-fg-subtle mt-1 font-mono tabular">
              <Link
                href={{ pathname: `/projects/${a.project_id}/secrets` }}
                className="text-fg-muted hover:text-accent normal-case transition-colors duration-fast ease-snap"
              >
                {a.project_name}
              </Link>
              <span className="mx-2 text-fg-subtle/60">·</span>
              {a.requester_email ?? a.requester_user_id}
              <span className="mx-2 text-fg-subtle/60">·</span>
              {relative(a.created_at)}
              {a.status === 'granted' && a.expires_at ? (
                <>
                  <span className="mx-2 text-fg-subtle/60">·</span>
                  <span className="text-fg-muted">{formatExpiresIn(a.expires_at)}</span>
                </>
              ) : null}
              {a.reason ? (
                <>
                  <span className="mx-2 text-fg-subtle/60">·</span>
                  <span className="italic normal-case">&ldquo;{a.reason}&rdquo;</span>
                </>
              ) : null}
            </div>
          </div>

          <Link href={{ pathname: `/projects/${a.project_id}/approvals` }} className="shrink-0">
            <Button size="sm" variant="outline" className="gap-1">
              {cta}
              <ArrowUpRight size={11} strokeWidth={2.25} />
            </Button>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyQueue({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-8 text-center">
      <InboxIcon size={20} className="mx-auto mb-3 text-fg-subtle" strokeWidth={1.75} aria-hidden />
      <p className="text-sm text-fg-muted">{label}</p>
    </div>
  );
}

function statusTone(s: ApprovalRow['status']): 'warn' | 'success' | 'danger' | 'neutral' {
  if (s === 'pending') return 'warn';
  if (s === 'granted') return 'success';
  if (s === 'denied') return 'danger';
  return 'neutral';
}
