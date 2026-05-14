import { api } from '@/lib/api';
import { SecretsClient } from './_components/secrets-client';

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
    <SecretsClient
      projectId={id}
      environments={project.environments.map((e) => ({ name: e.name, tier: e.tier }))}
      secrets={secretsResp.secrets}
    />
  );
}
