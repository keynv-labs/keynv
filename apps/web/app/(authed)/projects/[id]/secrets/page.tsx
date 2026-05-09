import { Breadcrumb } from '@/components/layout/breadcrumb';
import { api } from '@/lib/api';
import { SecretsClient } from './secrets-client';

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

export default async function SecretsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, secretsResp] = await Promise.all([
    api<ProjectDetail>(`/v1/projects/${id}`),
    api<{ secrets: SecretRow[] }>(`/v1/projects/${id}/secrets`),
  ]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        segments={[
          { label: 'Projects', href: '/projects' },
          { label: project.name, href: `/projects/${id}` },
          { label: 'Secrets' },
        ]}
      />

      <SecretsClient
        projectId={id}
        environments={project.environments.map((e) => ({ name: e.name, tier: e.tier }))}
        secrets={secretsResp.secrets}
      />
    </div>
  );
}
