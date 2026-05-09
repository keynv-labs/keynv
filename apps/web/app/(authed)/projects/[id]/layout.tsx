import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { type RouteTab, RouteTabs } from '@/components/ui/route-tabs';
import { type ApiError, api } from '@/lib/api';

interface ProjectShallow {
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

  const tabs: RouteTab[] = [
    {
      href: `/projects/${id}`,
      label: 'Overview',
      match: (p) => p === `/projects/${id}`,
    },
    {
      href: `/projects/${id}/secrets`,
      label: 'Secrets',
      match: (p) => p.startsWith(`/projects/${id}/secrets`),
    },
    {
      href: `/projects/${id}/audit`,
      label: 'Audit',
      match: (p) => p.startsWith(`/projects/${id}/audit`),
    },
    {
      href: `/projects/${id}/members`,
      label: 'Members',
      match: (p) => p.startsWith(`/projects/${id}/members`),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumb
          segments={[{ label: 'Projects', href: '/projects' }, { label: project.name }]}
        />
        <header className="mt-3">
          <h1 className="text-[22px] font-semibold tracking-tight">{project.name}</h1>
          <div className="font-mono text-xs text-fg-subtle mt-1">{project.id}</div>
        </header>
      </div>

      <RouteTabs tabs={tabs} />

      <div>{children}</div>
    </div>
  );
}
