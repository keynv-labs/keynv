'use client';

import { loadMoreOrgApprovalsAction } from '@/app/(authed)/actions';
import { SectionHeader, StatCard } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ArrowUpRight, Inbox as InboxIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

export interface ApprovalRow {
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

function statusTone(s: ApprovalRow['status']): 'warn' | 'success' | 'danger' | 'neutral' {
  if (s === 'pending') return 'warn';
  if (s === 'granted') return 'success';
  if (s === 'denied') return 'danger';
  return 'neutral';
}

export function InboxClient({
  initialApprovals,
  initialCursor,
  myUserId,
}: {
  initialApprovals: ApprovalRow[];
  initialCursor: string | null;
  myUserId: string;
}) {
  const [approvals, setApprovals] = useState<ApprovalRow[]>(initialApprovals);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  const sections = useMemo(() => {
    const pending = approvals.filter((a) => a.status === 'pending');
    const toReview = pending.filter((a) => a.requester_user_id !== myUserId);
    const myRequests = pending.filter((a) => a.requester_user_id === myUserId);
    const recentlyDecided = approvals
      .filter((a) => a.status !== 'pending')
      .sort(
        (a, b) =>
          Date.parse(b.decided_at ?? b.created_at) - Date.parse(a.decided_at ?? a.created_at),
      );
    return { pending, toReview, myRequests, recentlyDecided };
  }, [approvals, myUserId]);

  const loadMore = useCallback(async () => {
    if (cursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await loadMoreOrgApprovalsAction({ beforeCreatedAt: cursor });
      setApprovals((prev) => [...prev, ...(result.approvals as ApprovalRow[])]);
      setCursor(result.next_cursor);
    } catch {
      // silent fail — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="To review"
          value={sections.toReview.length.toLocaleString()}
          hint={sections.toReview.length === 0 ? 'queue is clear' : 'awaiting your decision'}
        />
        <StatCard
          label="Your requests"
          value={sections.myRequests.length.toLocaleString()}
          hint={sections.myRequests.length === 0 ? 'nothing pending' : 'waiting for a decision'}
        />
        <StatCard
          label="Pending total"
          value={sections.pending.length.toLocaleString()}
          hint="across all projects"
        />
        <StatCard
          label="Decided (loaded)"
          value={sections.recentlyDecided.length.toLocaleString()}
          hint={cursor !== null ? 'load more for older' : 'all loaded'}
        />
      </section>

      <section>
        <SectionHeader
          title="to review"
          count={sections.toReview.length}
          actions={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">
              · grants production access
            </span>
          }
        />
        {sections.toReview.length === 0 ? (
          <EmptyQueue label="No approvals waiting on you." />
        ) : (
          <ApprovalList rows={sections.toReview} cta="Review" />
        )}
      </section>

      {sections.myRequests.length > 0 ? (
        <section>
          <SectionHeader title="your requests" count={sections.myRequests.length} />
          <ApprovalList rows={sections.myRequests} cta="Open" />
        </section>
      ) : null}

      {sections.recentlyDecided.length > 0 ? (
        <section>
          <SectionHeader title="recently decided" count={sections.recentlyDecided.length} />
          <ApprovalList rows={sections.recentlyDecided} cta="Open" />
        </section>
      ) : null}

      {cursor !== null ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em]',
              'transition-colors duration-fast ease-snap',
              loadingMore
                ? 'text-fg-subtle cursor-not-allowed'
                : 'text-fg-muted hover:text-fg hover:border-border-strong',
            )}
          >
            {loadingMore ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                loading
              </>
            ) : (
              'load more'
            )}
          </button>
        </div>
      ) : null}
    </>
  );
}

function ApprovalList({ rows, cta }: { rows: ApprovalRow[]; cta: string }) {
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
                href={`/projects/${a.project_id}/secrets`}
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

          <Link href={`/projects/${a.project_id}/approvals`} className="shrink-0">
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
