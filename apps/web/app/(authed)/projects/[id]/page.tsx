import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { type ApiError, api } from '@/lib/api';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface ProjectDetail {
  id: string;
  name: string;
  created_at: string;
  environments: Array<{
    id: string;
    name: string;
    tier: string;
    require_approval: boolean;
  }>;
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let project: ProjectDetail;
  try {
    project = await api<ProjectDetail>(`/v1/projects/${id}`);
  } catch (err) {
    if ((err as ApiError).status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="text-xs text-[var(--color-fg-muted)] mono mt-1">{project.id}</p>
        </div>
        <div className="flex gap-2">
          <Link href={{ pathname: `/projects/${id}/secrets` }}>
            <Button variant="ghost">Secrets</Button>
          </Link>
          <Link href={{ pathname: `/projects/${id}/members` }}>
            <Button variant="ghost">Members</Button>
          </Link>
          <Link href={{ pathname: `/projects/${id}/audit` }}>
            <Button variant="ghost">Audit</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardTitle>Environments</CardTitle>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--color-fg-muted)]">
            <tr>
              <th className="pb-2">Name</th>
              <th className="pb-2">Tier</th>
              <th className="pb-2">Approval</th>
            </tr>
          </thead>
          <tbody>
            {project.environments.map((e) => (
              <tr key={e.id} className="border-t border-[var(--color-border)]">
                <td className="py-2 mono">{e.name}</td>
                <td className="py-2">
                  {e.tier === 'production' ? (
                    <span className="text-[var(--color-warn)]">production</span>
                  ) : (
                    <span className="text-[var(--color-fg-muted)]">non-production</span>
                  )}
                </td>
                <td className="py-2">
                  {e.require_approval ? (
                    <span className="text-[var(--color-warn)]">required</span>
                  ) : (
                    <span className="text-[var(--color-fg-muted)]">not required</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
