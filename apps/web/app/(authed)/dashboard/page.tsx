import type { AuditEntry } from '@/components/audit/audit-timeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader, SectionHeader, StatCard } from '@/components/layout/page-header';
import { OnboardingChecklist } from '@/components/onboarding/checklist';
import { api } from '@/lib/api';
import { type OnboardingStatus, isOnboardingComplete } from '@/lib/onboarding';
import { fetchOnboardingStatus } from '@/lib/onboarding-server';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ActivityFeed } from './_components/activity-feed';
import { ProjectsSidebar } from './_components/projects-sidebar';
import { QuickActions } from './_components/quick-actions';
import { FirstRunEmpty } from './_components/empty-state';
import { ActivitySkeleton } from './_components/skeleton';

interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
  env_count: number;
  secret_count: number;
  pending_count: number;
}

interface PendingItem {
  project_id: string;
  project_name: string;
  pending_count: number;
}

export default function ActivityPage() {
  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Activity' }]} />

      <PageHeader
        eyebrow="dashboard · last 24h"
        title="Activity"
        description="Everything that happened across your organization. Recent secret changes, approval requests, member moves — all hash-chained."
      />

      <Suspense fallback={<ActivitySkeleton />}>
        <ActivityContent />
      </Suspense>
    </div>
  );
}

async function ActivityContent() {
  const [data, audit, onboarding] = await Promise.all([
    api<{ projects: ProjectSummary[] }>('/v1/projects/summary').then((r) => r.projects),
    api<{ entries: AuditEntry[] }>('/v1/audit', { query: { limit: 100 } }).then((r) => r.entries),
    safeFetchOnboarding(),
  ]);

  const showChecklist =
    onboarding !== null && !isOnboardingComplete(onboarding) && !onboarding.dismissed;

  if (data.length === 0) {
    return showChecklist ? <OnboardingChecklist initialStatus={onboarding} /> : <FirstRunEmpty />;
  }

  const totalSecrets = data.reduce((sum, p) => sum + p.secret_count, 0);
  const totalEnvs = data.reduce((sum, p) => sum + p.env_count, 0);
  const pendingItems: PendingItem[] = data
    .filter((p) => p.pending_count > 0)
    .map((p) => ({
      project_id: p.id,
      project_name: p.name,
      pending_count: p.pending_count,
    }));
  const last24hEvents = audit.filter(
    (e) => Date.now() - Date.parse(e.ts) < 24 * 60 * 60 * 1000,
  ).length;

  return (
    <>
      {showChecklist ? <OnboardingChecklist initialStatus={onboarding} compact /> : null}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Projects"
          value={data.length.toLocaleString()}
          hint={`${totalEnvs} env · ${totalSecrets} keys`}
        />
        <StatCard
          label="Pending"
          value={pendingItems.length.toLocaleString()}
          hint={pendingItems.length === 0 ? 'queue is clear' : 'awaiting decision'}
        />
        <StatCard
          label="Events · 24h"
          value={last24hEvents.toLocaleString()}
          hint="audit-chained"
        />
        <StatCard label="Audit" value={audit.length.toLocaleString()} hint="last 100 entries" />
      </section>

      {pendingItems.length > 0 ? (
        <section>
          <SectionHeader
            title="awaiting your review"
            count={pendingItems.length}
            actions={
              <Link
                href="/inbox"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
              >
                full inbox
                <ArrowUpRight size={11} strokeWidth={2} />
              </Link>
            }
          />
          <ul className="rounded-lg border border-warn-soft-border bg-warn-soft/30 divide-y divide-border overflow-hidden">
            {pendingItems.slice(0, 6).map((p) => (
              <li
                key={p.project_id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
              >
                <Badge tone="warn">pending</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-fg break-all">
                    {p.project_name}
                  </div>
                  <div className="text-[11px] text-fg-subtle mt-1 font-mono tabular">
                    {p.pending_count} pending ·{' '}
                    <Link
                      href={`/projects/${p.project_id}/approvals`}
                      className="text-fg-muted hover:text-accent normal-case"
                    >
                      review
                    </Link>
                  </div>
                </div>
                <Link href={`/projects/${p.project_id}/approvals`}>
                  <Button size="sm" variant="outline" className="gap-1">
                    Review
                    <ArrowUpRight size={12} strokeWidth={2.25} />
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
          {pendingItems.length > 6 ? (
            <div className="mt-2 text-right">
              <Link
                href="/inbox"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle hover:text-accent transition-colors duration-fast ease-snap"
              >
                +{pendingItems.length - 6} more · open inbox
                <ArrowUpRight size={11} strokeWidth={2} />
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <div>
          <SectionHeader
            title="recent activity"
            count={audit.length}
            actions={
              <Link
                href="/audit"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
              >
                full audit
                <ArrowUpRight size={11} strokeWidth={2} />
              </Link>
            }
          />
          {audit.length === 0 ? (
            <div className="rounded-lg border border-border bg-bg-elevated p-8 text-center text-sm text-fg-muted">
              No activity yet. Once you create projects and add secrets, they appear here.
            </div>
          ) : (
            <ActivityFeed entries={audit.slice(0, 30)} />
          )}
        </div>

        <aside className="space-y-6">
          <ProjectsSidebar items={data.slice(0, 6).map((p) => ({
            project: { id: p.id, name: p.name, created_at: p.created_at },
            envCount: p.env_count,
            secretCount: p.secret_count,
            pending: [],
          }))} totalCount={data.length} />
          <QuickActions />
        </aside>
      </section>
    </>
  );
}

async function safeFetchOnboarding(): Promise<OnboardingStatus | null> {
  try {
    return await fetchOnboardingStatus();
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';
