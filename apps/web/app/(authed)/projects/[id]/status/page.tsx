import { api } from '@/lib/api';
import { StatusClient } from './status-client';

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

export default async function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, secretsResp] = await Promise.all([
    api<ProjectDetail>(`/v1/projects/${id}`),
    api<{ secrets: SecretRow[] }>(`/v1/projects/${id}/secrets`),
  ]);

  return (
    <StatusClient
      projectId={id}
      environments={project.environments.map((e) => ({ name: e.name, tier: e.tier }))}
      secrets={secretsResp.secrets}
    />
  );
}
