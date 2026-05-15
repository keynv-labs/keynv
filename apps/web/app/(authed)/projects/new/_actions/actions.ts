'use server';

import { catchApi, parseRaw } from '@/lib/action-result';
import { api } from '@/lib/api';
import { requireCsrf } from '@/lib/csrf';
import { EnvSpec, projectName } from '@/lib/schemas';
import { z } from 'zod';

export interface CreateProjectState {
  error?: string;
  projectId?: string;
}

const Body = z.object({
  name: projectName,
  environments: z.array(EnvSpec).min(1).max(16),
});

export async function createProjectAction(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const csrf = requireCsrf(formData);
  if (csrf) return csrf;

  const name = String(formData.get('name') ?? '');
  const envSpecs = String(formData.get('environments') ?? 'dev')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const environments = envSpecs.map((spec) => {
    const [n, tier, approval] = spec.split(':');
    return {
      name: n ?? '',
      tier: (tier as 'production' | 'non-production' | undefined) ?? 'non-production',
      require_approval: approval === 'approval',
    };
  });

  const parsed = parseRaw(Body, { name, environments });
  if (!parsed.success) return { error: parsed.error };

  const result = await catchApi(() =>
    api<{ id: string }>('/v1/projects', {
      method: 'POST',
      body: parsed.data,
    }),
  );
  if (!result.success) return { error: result.error };
  return { projectId: result.data.id };
}
