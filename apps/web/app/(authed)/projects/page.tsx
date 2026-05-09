import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  created_at: string;
}

export default async function ProjectsPage() {
  const session = await getSession();
  const data = await api<{ projects: Project[] }>('/v1/projects');
  const canCreate = session?.org_role === 'owner' || session?.org_role === 'admin';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Projects</h1>
        {canCreate ? (
          <Link href="/projects/new">
            <Button>New project</Button>
          </Link>
        ) : null}
      </div>

      {data.projects.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-fg-muted)]">
            No projects yet.{' '}
            {canCreate ? 'Create one to get started.' : 'Ask an admin to add you to a project.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.projects.map((p) => (
            <Link key={p.id} href={{ pathname: `/projects/${p.id}` }}>
              <Card className="hover:bg-[var(--color-bg-card-hover)] transition-colors cursor-pointer">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-[var(--color-fg-muted)] mt-1 mono">{p.id}</div>
                <div className="text-xs text-[var(--color-fg-muted)] mt-2">
                  Created {new Date(p.created_at).toLocaleDateString()}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
