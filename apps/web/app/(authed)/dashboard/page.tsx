import type { AuditEntry } from '@/components/audit/audit-timeline';
import { actorInitials, dayBucket, describeEvent, relativeTime } from '@/components/audit/event';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader, SectionHeader, StatCard } from '@/components/layout/page-header';
import { OnboardingChecklist } from '@/components/onboarding/checklist';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { type OnboardingStatus, isOnboardingComplete } from '@/lib/onboarding';
import { fetchOnboardingStatus } from '@/lib/onboarding-server';
import { ArrowUpRight, KeyRound, Plus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

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

interface PendingItem extends ApprovalRow {
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
                href={{ pathname: '/inbox' }}
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
                      href={{ pathname: `/projects/${p.project_id}/approvals` }}
                      className="text-fg-muted hover:text-accent normal-case"
                    >
                      {p.project_name}
                    </Link>
                  </div>
                </div>
                <Link href={{ pathname: `/projects/${p.project_id}/approvals` }}>
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
                href={{ pathname: '/inbox' }}
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
                href={{ pathname: '/audit' }}
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

// ─── Activity feed ───────────────────────────────────────────────────────────

function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  const grouped = new Map<string, { label: string; entries: AuditEntry[] }>();
  for (const e of entries) {
    const { key, label } = dayBucket(e.ts);
    const bucket = grouped.get(key);
    if (bucket) bucket.entries.push(e);
    else grouped.set(key, { label, entries: [e] });
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([key, { label, entries: dayEntries }]) => (
        <section key={key}>
          <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle flex items-center gap-2 mb-2">
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
            {label}
          </h3>
          <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
            {dayEntries.map((entry) => (
              <FeedRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FeedRow({ entry }: { entry: AuditEntry }) {
  const description = describeEvent(entry.event_type, entry.payload);
  const initials = actorInitials(entry.actor_user_id, entry.actor_agent);
  const isSystem = entry.actor_user_id === null;

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 animate-list-enter">
      <span
        aria-hidden
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-semibold',
          isSystem
            ? 'border-border bg-bg-inset text-fg-muted'
            : 'border-border-strong bg-bg-inset text-fg',
        )}
      >
        {initials}
      </span>
      <div className="flex-1 min-w-0 text-sm text-fg leading-tight truncate">
        <span className="font-mono text-[12px] text-fg-muted">
          {isSystem ? 'system' : entry.actor_user_id}
        </span>
        <span className="mx-1.5 text-fg-muted">{description.verb}</span>
        {description.subject ? (
          <span
            className={cn(
              description.subjectMono ? 'font-mono text-[12.5px]' : '',
              description.tone === 'danger' && 'text-danger',
              description.tone === 'warn' && 'text-warn',
              description.tone === 'success' && 'text-success',
              !description.tone && 'text-accent',
            )}
          >
            {description.subject}
          </span>
        ) : null}
      </div>
      <span
        className="shrink-0 font-mono text-[11px] tabular text-fg-subtle"
        title={new Date(entry.ts).toLocaleString()}
      >
        {relativeTime(entry.ts)}
      </span>
    </li>
  );
}

// ─── Projects sidebar (in activity page) ─────────────────────────────────────

function ProjectsSidebar({
  items,
  totalCount,
}: {
  items: Array<{
    project: ProjectListItem;
    envCount: number;
    secretCount: number;
    pending: PendingItem[];
  }>;
  totalCount: number;
}) {
  return (
    <div>
      <SectionHeader
        title="projects"
        count={totalCount}
        actions={
          <Link
            href={{ pathname: '/projects' }}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
          >
            all
            <ArrowUpRight size={11} strokeWidth={2} />
          </Link>
        }
      />
      <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
        {items.map((x) => (
          <li key={x.project.id} className="animate-list-enter">
            <Link
              href={{ pathname: `/projects/${x.project.id}/secrets` }}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-fg truncate tracking-tight">
                  {x.project.name}
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular text-fg-subtle">
                  {x.secretCount} keys · {x.envCount} env
                  {x.pending.length > 0 ? (
                    <span className="ml-2 text-warn">· {x.pending.length} pending</span>
                  ) : null}
                </div>
              </div>
              <ArrowUpRight
                size={13}
                strokeWidth={2}
                className="shrink-0 text-fg-subtle group-hover:text-accent transition-colors"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Quick actions ───────────────────────────────────────────────────────────

function QuickActions() {
  return (
    <div>
      <SectionHeader title="quick actions" />
      <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
        <ActionLink
          href="/projects/new"
          icon={<Plus size={14} strokeWidth={2.25} className="text-accent" />}
          title="New project"
          subtitle="Spin up a new namespace"
        />
        <ActionLink
          href="/audit"
          icon={<ShieldCheck size={14} strokeWidth={2} className="text-success" />}
          title="Verify audit chain"
          subtitle="Recompute hash integrity"
        />
        <ActionLink
          href="/settings/account/cli-tokens"
          icon={<KeyRound size={14} strokeWidth={2} className="text-fg-muted" />}
          title="Issue CLI token"
          subtitle="For headless agents and CI"
        />
      </div>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={{ pathname: href } as never}
      className="group flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
    >
      <span
        aria-hidden
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-inset"
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-fg truncate">{title}</div>
        <div className="mt-0.5 text-[11px] text-fg-subtle">{subtitle}</div>
      </div>
      <ArrowUpRight
        size={13}
        strokeWidth={2}
        className="shrink-0 text-fg-subtle group-hover:text-accent transition-colors"
      />
    </Link>
  );
}

// ─── Empty / loading ─────────────────────────────────────────────────────────

function FirstRunEmpty() {
  return (
    <div className="relative rounded-xl border border-border bg-bg-elevated p-10 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
      <div className="relative mx-auto max-w-md text-center">
        <h2 className="display text-xl tracking-tight text-fg">No projects yet</h2>
        <p className="text-sm text-fg-muted mt-3 leading-relaxed">
          Activity shows up here once you create your first project. Each project is a namespace for
          secrets your AI agents will reference by alias.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2">
          <Link href={{ pathname: '/projects/new' }}>
            <Button className="gap-1.5">
              <Plus size={14} strokeWidth={2.25} />
              Create first project
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-bg-elevated p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16 mt-3" />
          </div>
        ))}
      </section>
      <section>
        <Skeleton className="h-3 w-32 mb-3" />
        <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-4 flex-1 max-w-md" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
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

// Avoid Next caching of the personalized feed.
export const dynamic = 'force-dynamic';
