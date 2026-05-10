import { isCancel, select } from '@clack/prompts';
import type { ApiClient } from '../../client/http.js';

interface ProjectDetail {
  id: string;
  name: string;
  environments: Array<{ name: string; tier: string; require_approval: boolean }>;
}

export async function describeProject(client: ApiClient, projectId: string): Promise<ProjectDetail> {
  return client.request<ProjectDetail>(`/v1/projects/${projectId}`);
}

export async function pickEnv(
  client: ApiClient,
  projectId: string,
  message = 'Environment:',
): Promise<string | null> {
  const detail = await describeProject(client, projectId);
  if (detail.environments.length === 0) return null;
  if (detail.environments.length === 1) return detail.environments[0]?.name ?? null;
  const value = await select({
    message,
    options: detail.environments.map((e) => ({
      value: e.name,
      label: e.name,
      hint: `${e.tier}${e.require_approval ? ' • approval' : ''}`,
    })),
  });
  if (isCancel(value)) return null;
  return value as string;
}
