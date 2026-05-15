'use server';

import { type ActionState, catchApi, parseOr } from '@/lib/action-result';
import { api } from '@/lib/api';
import { requireCsrf } from '@/lib/csrf';
import { email, projectId, projectRole } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const AddBody = z.object({
  project_id: projectId,
  email,
  role: projectRole,
});

export type MemberActionState = ActionState;

export async function addMemberAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const csrf = requireCsrf(formData);
  if (csrf) return csrf;

  const parsed = parseOr(AddBody, formData, ['project_id', 'email', 'role']);
  if (!parsed.success) return parsed;

  const result = await catchApi(() =>
    api(`/v1/projects/${parsed.data.project_id}/members`, {
      method: 'POST',
      body: { email: parsed.data.email, role: parsed.data.role },
    }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath(`/projects/${parsed.data.project_id}/settings`);
  return { ok: `added ${parsed.data.email}` };
}

export async function removeMemberAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const csrf = requireCsrf(formData);
  if (csrf) return csrf;

  const project_id = String(formData.get('project_id') ?? '');
  const user_id = String(formData.get('user_id') ?? '');
  if (!project_id || !user_id) return { error: 'Missing project_id or user_id.' };

  const result = await catchApi(() =>
    api(`/v1/projects/${project_id}/members/${user_id}`, { method: 'DELETE' }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath(`/projects/${project_id}/settings`);
  return { ok: 'Member removed.' };
}
