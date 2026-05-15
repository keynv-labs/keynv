'use server';

import { api } from '@/lib/api';

export interface SearchResult {
  secret_id: string;
  key: string;
  version: number;
  project_id: string;
  project_name: string;
  env_name: string;
  env_tier: string;
  created_at: string;
}

interface SearchResponse {
  results: SearchResult[];
  next_cursor: string | null;
}

export async function searchSecrets(q: string, beforeCreatedAt?: string): Promise<SearchResponse> {
  return api<SearchResponse>('/v1/secrets/search', {
    query: {
      q,
      limit: 50,
      ...(beforeCreatedAt ? { before_created_at: beforeCreatedAt } : {}),
    },
  });
}
