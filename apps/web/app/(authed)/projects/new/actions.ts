'use server';

import { type ApiError, api } from '@/lib/api';
import { z } from 'zod';

const Env = z.object({
  name: z.string().min(1),
  tier: z.enum(['production', 'non-production']).default('non-production'),
  require_approval: z.boolean().default(false),
});

const Body = z.object({
  name: z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase kebab-case only'),
  environments: z.array(Env).min(1).max(16),
});

export interface CreateProjectState {
  error?: string;
  projectId?: string;
}

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

  const parsed = Body.safeParse({ name, environments });
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }

  let project: { id: string };
  try {
    project = await api<{ id: string }>('/v1/projects', {
      method: 'POST',
      body: parsed.data,
    });
  } catch (err) {
    const e = err as ApiError;
    return { error: e.message };
  }
  return { projectId: project.id };
}
