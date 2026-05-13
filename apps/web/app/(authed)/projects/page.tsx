import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader, SectionHeader, StatCard } from '@/components/layout/page-header';
import { OnboardingChecklist } from '@/components/onboarding/checklist';
import { Badge, envTone } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { type OnboardingStatus, isOnboardingComplete } from '@/lib/onboarding';
import { fetchOnboardingStatus } from '@/lib/onboarding-server';
import { getSession } from '@/lib/session';
import { ArrowUpRight, Terminal } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { NewProjectButton } from './new-project-button';

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

interface EnrichedProject extends ProjectListItem {
  environments: Array<{ name: string; tier: string }>;
  secret_count: number;
}

async function loadProjects(): Promise<EnrichedProject[]> {
  const list = await api<{ projects: ProjectListItem[] }>('/v1/projects');
  return Promise.all(
    list.projects.map(async (p) => {
      const [detail, secrets] = await Promise.all([
        api<ProjectDetail>(`/v1/projects/${p.id}`),
        api<{ secrets: SecretRow[] }>(`/v1/projects/${p.id}/secrets`),
      ]);
      return {
        ...p,
        environments: detail.environments.map((e) => ({ name: e.name, tier: e.tier })),
        secret_count: secrets.secrets.length,
      };
    }),
  );
}

function formatRelative(iso: string): string {
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

export default async function ProjectsPage() {
  const session = await getSession();
  const canCreate = session?.org_role === 'owner' || session?.org_role === 'admin';

  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Projects' }]} />

      <PageHeader
        eyebrow="vault · all projects"
        title="Projects"
        description="Operational state across your organization."
        actions={canCreate ? <NewProjectButton /> : null}
      />

      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsContent canCreate={canCreate} />
      </Suspense>
    </div>
  );
}

async function ProjectsContent({ canCreate }: { canCreate: boolean }) {
  const [projects, onboarding] = await Promise.all([loadProjects(), safeFetchOnboarding()]);
  const showChecklist = onboarding !== null && !isOnboardingComplete(onboarding);

  if (projects.length === 0) {
    return showChecklist ? (
      <OnboardingChecklist initialStatus={onboarding} />
    ) : (
      <EmptyState canCreate={canCreate} />
    );
  }

  const totalSecrets = projects.reduce((sum, p) => sum + p.secret_count, 0);
  const totalEnvs = projects.reduce((sum, p) => sum + p.environments.length, 0);

  return (
    <>
      {showChecklist ? <OnboardingChecklist initialStatus={onboarding} compact /> : null}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Projects" value={projects.length.toLocaleString()} hint="namespaces" />
        <StatCard label="Environments" value={totalEnvs.toLocaleString()} hint="dev · stg · prod" />
        <StatCard label="Secrets" value={totalSecrets.toLocaleString()} hint="encrypted at rest" />
      </section>

      <section>
        <SectionHeader
          title="all projects"
          count={projects.length}
          actions={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
              sorted by recency
            </span>
          }
        />

        <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {projects.map((p) => (
            <li key={p.id} className="animate-list-enter">
              <Link
                href={{ pathname: `/projects/${p.id}` }}
                className="group block px-4 py-4 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-fg truncate tracking-tight">
                        {p.name}
                      </span>
                      <span className="font-mono text-[11px] text-fg-subtle tabular">{p.id}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-fg-muted">
                      <span className="font-mono tabular">
                        {p.secret_count} {p.secret_count === 1 ? 'secret' : 'secrets'}
                      </span>
                      <span className="text-fg-subtle">·</span>
                      <span>created {formatRelative(p.created_at)}</span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5">
                    {p.environments.map((env) => (
                      <Badge key={env.name} tone={envTone(env.tier)}>
                        {env.name}
                      </Badge>
                    ))}
                  </div>

                  <ArrowUpRight
                    size={15}
                    className="shrink-0 text-fg-subtle group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-fast ease-snap"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
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

function ProjectsSkeleton() {
  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-bg-elevated p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16 mt-3" />
          </div>
        ))}
      </section>
      <section>
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="relative rounded-xl border border-border bg-bg-elevated p-10 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
      <div className="relative mx-auto max-w-md text-center">
        <h2 className="display text-xl tracking-tight text-fg">No projects yet</h2>
        <p className="text-sm text-fg-muted mt-3 leading-relaxed">
          A project is a namespace for secrets. References look like{' '}
          <code className="text-accent">@&lt;project&gt;.&lt;env&gt;.&lt;key&gt;</code> and get
          resolved by the keynv CLI without exposing the value to your AI agent.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-bg-inset p-4 text-left">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">
            <Terminal size={12} className="text-accent" />
            example
          </div>
          <pre className="mt-3 font-mono text-[12px] text-fg-muted leading-relaxed whitespace-pre-wrap break-words">
            <span className="text-fg-subtle">$ </span>keynv exec -- pnpm dev{'\n'}
            <span className="text-fg-subtle"> # </span>resolves{' '}
            <span className="text-accent">@billing.dev.STRIPE_KEY</span> into the subprocess
          </pre>
        </div>

        {canCreate ? (
          <div className="mt-7">
            <NewProjectButton label="Create first project" />
            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
              or run <code className="text-accent normal-case">keynv project init</code> from the
              CLI
            </div>
          </div>
        ) : (
          <p className="mt-6 text-xs text-fg-subtle">Ask an admin to create one.</p>
        )}
      </div>
    </div>
  );
}
