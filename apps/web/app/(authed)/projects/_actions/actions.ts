'use server';

import { api } from '@/lib/api';

export interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
  env_count: number;
  secret_count: number;
  pending_count: number;
  env_names: string | null;
}

/** Server action: fetches next page of project summaries older than the given created_at cursor. */
export async function loadMoreProjectsAction(
  beforeCreatedAt: string,
): Promise<{ projects: ProjectSummary[]; next_cursor: string | null }> {
  return api('/v1/projects/summary', {
    query: { limit: 50, before_created_at: beforeCreatedAt },
  });
}
