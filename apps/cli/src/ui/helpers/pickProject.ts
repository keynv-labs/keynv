import { isCancel, select } from '@clack/prompts';
import type { ApiClient } from '../../client/http.js';

export interface ProjectSummary {
  id: string;
  name: string;
}

export async function listProjects(client: ApiClient): Promise<ProjectSummary[]> {
  const data = await client.request<{ projects: ProjectSummary[] }>('/v1/projects');
  return data.projects;
}

export async function pickProject(
  client: ApiClient,
  message = 'Project:',
): Promise<ProjectSummary | null> {
  const projects = await listProjects(client);
  if (projects.length === 0) return null;
  const value = await select({
    message,
    options: projects.map((p) => ({ value: p.id, label: p.name, hint: p.id })),
  });
  if (isCancel(value)) return null;
  const match = projects.find((p) => p.id === value);
  return match ?? null;
}
