'use server';

import { api } from '@/lib/api';

export async function searchSecrets(q: string) {
  const data = await api<{ results: Array<{
    secret_id: string;
    key: string;
    version: number;
    project_id: string;
    project_name: string;
    env_name: string;
    env_tier: string;
    created_at: string;
  }> }>('/v1/secrets/search', { query: { q } });
  return { results: data.results };
}
