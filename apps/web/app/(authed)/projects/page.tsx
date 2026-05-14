import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { OnboardingChecklist } from '@/components/onboarding/checklist';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { type OnboardingStatus, isOnboardingComplete } from '@/lib/onboarding';
import { fetchOnboardingStatus } from '@/lib/onboarding-server';
import { getSession } from '@/lib/session';
import { Terminal } from 'lucide-react';
import { Suspense } from 'react';
import { NewProjectButton } from './new-project-button';
import type { ProjectSummary } from './_actions/actions';
import { ProjectsListing } from './_components/projects-listing';

interface SummaryResponse {
  projects: ProjectSummary[];
  next_cursor: string | null;
}

async function loadProjects(): Promise<SummaryResponse> {
  // Single aggregated query. The old client called /v1/projects then
  // GET /:id and GET /:id/secrets per project (1 + 2N), which fell over
  // once an org hit ~25 projects. /v1/projects/summary now does the
  // counts and env-name concat in one round trip.
  return api<SummaryResponse>('/v1/projects/summary', { query: { limit: 50 } });
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
  const [summary, onboarding] = await Promise.all([loadProjects(), safeFetchOnboarding()]);
  const projects = summary.projects;
  const showChecklist =
    onboarding !== null && !isOnboardingComplete(onboarding) && !onboarding.dismissed;

  if (projects.length === 0) {
    return showChecklist ? (
      <OnboardingChecklist initialStatus={onboarding} />
    ) : (
      <EmptyState canCreate={canCreate} />
    );
  }

  return (
    <>
      {showChecklist ? <OnboardingChecklist initialStatus={onboarding} compact /> : null}

      <ProjectsListing initialProjects={projects} initialCursor={summary.next_cursor} />
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
