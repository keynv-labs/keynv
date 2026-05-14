import type { AuditEntry } from '@/components/audit/audit-timeline';
import { relativeTime } from '@/components/audit/event';
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

interface ProjectListItem {
  id: string;
  name: string;
  created_at: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  environments: Array<{ name: string; tier: string; require_approval: boolean }>;
}

interface SecretRow {
  alias: string;
  version: number;
  created_at: string;
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

export interface PendingItem extends ApprovalRow {
  project_id: string;
  project_name: string;
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
  const [projects, audit, onboarding] = await Promise.all([
    api<{ projects: ProjectListItem[] }>('/v1/projects').then((r) => r.projects),
    api<{ entries: AuditEntry[] }>('/v1/audit', { query: { limit: 100 } }).then((r) => r.entries),
    safeFetchOnboarding(),
  ]);

  const showChecklist =
    onboarding !== null && !isOnboardingComplete(onboarding) && !onboarding.dismissed;

  if (projects.length === 0) {
    return showChecklist ? <OnboardingChecklist initialStatus={onboarding} /> : <FirstRunEmpty />;
  }

  // Pull per-project context in parallel: secrets count + pending approvals.
  // No org-wide approvals endpoint today, so we fan out — fine for the
  // dashboard scale (Phase 6 would back this with a real index).
  const perProject = await Promise.all(
    projects.map(async (p) => {
      const [detail, secrets, approvals] = await Promise.all([
        api<ProjectDetail>(`/v1/projects/${p.id}`).catch(() => null),
        api<{ secrets: SecretRow[] }>(`/v1/projects/${p.id}/secrets`).catch(() => ({
          secrets: [],
        })),
        api<{ approvals: ApprovalRow[] }>(`/v1/projects/${p.id}/approvals`).catch(() => ({
          approvals: [],
        })),
      ]);
      return {
        project: p,
        envCount: detail?.environments.length ?? 0,
        secretCount: secrets.secrets.length,
        pending: approvals.approvals
          .filter((a) => a.status === 'pending')
          .map<PendingItem>((a) => ({ ...a, project_id: p.id, project_name: p.name })),
      };
    }),
  );

  const totalSecrets = perProject.reduce((sum, x) => sum + x.secretCount, 0);
  const totalEnvs = perProject.reduce((sum, x) => sum + x.envCount, 0);
  const pendingItems = perProject.flatMap((x) => x.pending);
  const last24hEvents = audit.filter(
    (e) => Date.now() - Date.parse(e.ts) < 24 * 60 * 60 * 1000,
  ).length;

  return (
    <>
      {showChecklist ? <OnboardingChecklist initialStatus={onboarding} compact /> : null}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Projects"
          value={projects.length.toLocaleString()}
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
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
              >
                <Badge tone="warn">pending</Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[13px] text-fg break-all tabular">
                    <span className="text-accent">@</span>
                    {p.alias.replace(/^@/, '')}
                  </div>
                  <div className="text-[11px] text-fg-subtle mt-1 font-mono tabular">
                    {p.requester_email ?? p.requester_user_id} · {relativeTime(p.created_at)} ·{' '}
                    <Link
                      href={`/projects/${p.project_id}/approvals`}
                      className="text-fg-muted hover:text-accent normal-case"
                    >
                      {p.project_name}
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
          <ProjectsSidebar items={perProject.slice(0, 6)} totalCount={perProject.length} />
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
