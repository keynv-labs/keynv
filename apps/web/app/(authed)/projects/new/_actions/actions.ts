'use server';

import { api } from '@/lib/api';
import { z } from 'zod';
import { projectName, EnvSpec } from '@/lib/schemas';
import { parseRaw, catchApi } from '@/lib/action-result';

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
