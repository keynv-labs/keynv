import { Breadcrumb } from '@/components/layout/breadcrumb';
import { ProjectSwitcher } from '@/components/layout/project-switcher';
import { type RouteTab, RouteTabs } from '@/components/ui/route-tabs';
import { type ApiError, api } from '@/lib/api';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

interface ProjectShallow {
  id: string;
  name: string;
}

interface ProjectListItem {
  id: string;
  name: string;
}

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;
  let project: ProjectShallow;
  try {
    project = await api<ProjectShallow>(`/v1/projects/${id}`);
  } catch (err) {
    if ((err as ApiError).status === 404) notFound();
    throw err;
  }

  const allProjects = await api<{ projects: ProjectListItem[] }>('/v1/projects')
    .then((r) => r.projects)
    .catch(() => [project]);

  const tabs: RouteTab[] = [
    { href: `/projects/${id}/secrets`, label: 'Secrets', nested: true },
    { href: `/projects/${id}/approvals`, label: 'Approvals', nested: true },
    { href: `/projects/${id}/audit`, label: 'Audit', nested: true },
    { href: `/projects/${id}/settings`, label: 'Settings', nested: true },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb segments={[{ label: 'Projects', href: '/projects' }, { label: project.name }]} />

      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="display-eyebrow mb-2">project</div>
          <ProjectSwitcher current={project} projects={allProjects} />
          <code className="block font-mono text-xs text-fg-subtle tabular mt-2">{project.id}</code>
        </div>
      </header>

      <RouteTabs tabs={tabs} />

      <div>{children}</div>
    </div>
  );
}
