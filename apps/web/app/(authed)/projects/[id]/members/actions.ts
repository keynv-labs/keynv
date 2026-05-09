'use server';

import { type ApiError, api } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const AddBody = z.object({
  project_id: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['lead', 'developer', 'reader']),
});

export interface MemberActionState {
  error?: string;
  ok?: string;
}

export async function addMemberAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = AddBody.safeParse({
    project_id: formData.get('project_id'),
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  try {
    await api(`/v1/projects/${parsed.data.project_id}/members`, {
      method: 'POST',
      body: { email: parsed.data.email, role: parsed.data.role },
    });
  } catch (err) {
    return { error: (err as ApiError).message };
  }
  revalidatePath(`/projects/${parsed.data.project_id}/members`);
  return { ok: `added ${parsed.data.email}` };
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const project_id = String(formData.get('project_id') ?? '');
  const user_id = String(formData.get('user_id') ?? '');
  if (!project_id || !user_id) return;
  try {
    await api(`/v1/projects/${project_id}/members/${user_id}`, { method: 'DELETE' });
  } catch {
    /* ignore — refresh will surface */
  }
  revalidatePath(`/projects/${project_id}/members`);
}
