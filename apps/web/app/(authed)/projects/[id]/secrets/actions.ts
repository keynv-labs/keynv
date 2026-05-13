'use server';

import { type ApiError, api } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

const CreateBody = z.object({
  project_id: z.string().min(1),
  env: z
    .string()
    .min(1)
    .max(24)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  key: z.string().min(1).max(64).regex(KEY_RE),
  value: z
    .string()
    .min(0)
    .max(64 * 1024),
});

export interface SecretActionState {
  error?: string;
  ok?: string;
}

export async function createSecretAction(
  _prev: SecretActionState,
  formData: FormData,
): Promise<SecretActionState> {
  const parsed = CreateBody.safeParse({
    project_id: formData.get('project_id'),
    env: formData.get('env'),
    key: formData.get('key'),
    value: formData.get('value'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  try {
    await api<{ alias: string; version: number }>(
      `/v1/projects/${parsed.data.project_id}/secrets`,
      {
        method: 'POST',
        body: { env: parsed.data.env, key: parsed.data.key, value: parsed.data.value },
      },
    );
  } catch (err) {
    return { error: (err as ApiError).message };
  }
  revalidatePath(`/projects/${parsed.data.project_id}/secrets`);
  return { ok: `created @${parsed.data.env}.${parsed.data.key}` };
}

const RotateBody = z.object({
  project_id: z.string().min(1),
  env: z.string().min(1),
  key: z.string().min(1),
  new_value: z
    .string()
    .min(0)
    .max(64 * 1024),
});

export async function rotateSecretAction(
  _prev: SecretActionState,
  formData: FormData,
): Promise<SecretActionState> {
  const parsed = RotateBody.safeParse({
    project_id: formData.get('project_id'),
    env: formData.get('env'),
    key: formData.get('key'),
    new_value: formData.get('new_value'),
  });
  if (!parsed.success) {
    return { error: 'Invalid input.' };
  }
  try {
    await api(
      `/v1/projects/${parsed.data.project_id}/secrets/${parsed.data.env}/${parsed.data.key}/rotate`,
      { method: 'POST', body: { new_value: parsed.data.new_value } },
    );
  } catch (err) {
    return { error: (err as ApiError).message };
  }
  revalidatePath(`/projects/${parsed.data.project_id}/secrets`);
  return { ok: `rotated ${parsed.data.env}.${parsed.data.key}` };
}

export async function deleteSecretAction(formData: FormData): Promise<void> {
  const project_id = String(formData.get('project_id') ?? '');
  const env = String(formData.get('env') ?? '');
  const key = String(formData.get('key') ?? '');
  if (!project_id || !env || !key) return;
  try {
    await api(`/v1/projects/${project_id}/secrets/${env}/${key}`, { method: 'DELETE' });
  } catch {
    /* surfaced via revalidatePath refresh; no error UI for delete in v0 */
  }
  revalidatePath(`/projects/${project_id}/secrets`);
}
