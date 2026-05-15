'use server';

import { type ActionState, catchApi, parseOr } from '@/lib/action-result';
import { api } from '@/lib/api';
import { envName, projectId, secretKey, secretValue } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const CreateBody = z.object({
  project_id: projectId,
  env: envName,
  key: secretKey,
  value: secretValue,
});

export type SecretActionState = ActionState;

export async function createSecretAction(
  _prev: SecretActionState,
  formData: FormData,
): Promise<SecretActionState> {
  const parsed = parseOr(CreateBody, formData, ['project_id', 'env', 'key', 'value']);
  if (!parsed.success) return parsed;

  const result = await catchApi(() =>
    api<{ alias: string; version: number }>(`/v1/projects/${parsed.data.project_id}/secrets`, {
      method: 'POST',
      body: { env: parsed.data.env, key: parsed.data.key, value: parsed.data.value },
    }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath(`/projects/${parsed.data.project_id}/secrets`);
  return { ok: `created @${parsed.data.env}.${parsed.data.key}` };
}

const RotateBody = z.object({
  project_id: projectId,
  env: envName,
  key: secretKey,
  new_value: secretValue,
});

export async function rotateSecretAction(
  _prev: SecretActionState,
  formData: FormData,
): Promise<SecretActionState> {
  const parsed = parseOr(RotateBody, formData, ['project_id', 'env', 'key', 'new_value']);
  if (!parsed.success) return { error: 'Invalid input.' };

  const result = await catchApi(() =>
    api(
      `/v1/projects/${parsed.data.project_id}/secrets/${parsed.data.env}/${parsed.data.key}/rotate`,
      { method: 'POST', body: { new_value: parsed.data.new_value } },
    ),
  );
  if (!result.success) return { error: result.error };

  revalidatePath(`/projects/${parsed.data.project_id}/secrets`);
  return { ok: `rotated ${parsed.data.env}.${parsed.data.key}` };
}

export async function deleteSecretAction(
  _prev: SecretActionState,
  formData: FormData,
): Promise<SecretActionState> {
  const project_id = String(formData.get('project_id') ?? '');
  const env = String(formData.get('env') ?? '');
  const key = String(formData.get('key') ?? '');
  if (!project_id || !env || !key) return { error: 'Missing project_id, env, or key.' };

  const result = await catchApi(() =>
    api(`/v1/projects/${project_id}/secrets/${env}/${key}`, { method: 'DELETE' }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath(`/projects/${project_id}/secrets`);
  return { ok: `deleted ${env}.${key}` };
}
