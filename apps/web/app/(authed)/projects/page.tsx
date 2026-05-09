import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Badge, envTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { ArrowUpRight, Plus, Terminal } from 'lucide-react';
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
    <div className="space-y-6">
      <Breadcrumb segments={[{ label: 'Projects' }]} />

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight leading-tight">Projects</h1>
          <p className="text-sm text-fg-muted mt-1">Operational state across your organization.</p>
        </div>
        {canCreate ? (
          <Link href={{ pathname: '/projects/new' }}>
            <Button className="gap-1.5">
              <Plus size={14} strokeWidth={2.25} />
              New project
            </Button>
          </Link>
        ) : null}
      </header>

      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsContent canCreate={canCreate} />
      </Suspense>
    </div>
  );
}

async function ProjectsContent({ canCreate }: { canCreate: boolean }) {
  const projects = await loadProjects();

  if (projects.length === 0) {
    return <EmptyState canCreate={canCreate} />;
  }

  const totalSecrets = projects.reduce((sum, p) => sum + p.secret_count, 0);
  const totalEnvs = projects.reduce((sum, p) => sum + p.environments.length, 0);

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <RollupStat label="Projects" value={projects.length} />
        <RollupStat label="Environments" value={totalEnvs} />
        <RollupStat label="Secrets" value={totalSecrets} />
      </section>

      <section>
        <div className="px-1 mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            All projects
          </h2>
          <span className="text-xs text-fg-subtle">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {projects.map((p) => (
            <li key={p.id} className="animate-list-enter">
              <Link
                href={{ pathname: `/projects/${p.id}` }}
                className="group block px-4 py-3.5 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-fg truncate">{p.name}</span>
                      <span className="font-mono text-[11px] text-fg-subtle">{p.id}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-fg-muted">
                      <span>
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
                    className="shrink-0 text-fg-subtle group-hover:text-fg transition-colors duration-fast ease-snap"
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

function RollupStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
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
        <Skeleton className="h-3 w-24 mb-2" />
        <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-4">
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
    <div className="rounded-lg border border-border bg-bg-elevated p-10">
      <div className="mx-auto max-w-md text-center">
        <h2 className="text-base font-semibold text-fg">No projects yet</h2>
        <p className="text-sm text-fg-muted mt-2">
          A project is a namespace for secrets. References look like{' '}
          <code className="font-mono text-fg">@&lt;project&gt;.&lt;env&gt;.&lt;key&gt;</code> and
          get resolved by the keynv CLI without exposing the value to your AI agent.
        </p>

        <div className="mt-5 rounded-md border border-border bg-bg p-3 text-left">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            <Terminal size={12} />
            Example
          </div>
          <pre className="mt-2 font-mono text-[12px] text-fg-muted leading-relaxed whitespace-pre-wrap break-words">
            <span className="text-fg-subtle">$ </span>keynv exec -- pnpm dev{'\n'}
            <span className="text-fg-subtle"> </span>resolves{' '}
            <span className="text-fg">@billing.dev.STRIPE_KEY</span> into the subprocess
          </pre>
        </div>

        {canCreate ? (
          <div className="mt-6">
            <Link href={{ pathname: '/projects/new' }}>
              <Button>
                <Plus size={14} strokeWidth={2.25} />
                Create first project
              </Button>
            </Link>
            <div className="mt-2 text-xs text-fg-subtle">
              or run <code className="font-mono text-fg-muted">keynv project init</code> from the
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
