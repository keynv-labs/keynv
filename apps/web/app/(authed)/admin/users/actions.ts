'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { type ApiError, api } from '@/lib/api';

export interface UserActionState {
  error?: string;
  ok?: string;
}

const InviteBody = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
  org_role: z.enum(['admin', 'developer', 'reader']),
});

export async function inviteUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const parsed = InviteBody.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    org_role: formData.get('org_role'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; '),
    };
  }
  try {
    await api('/v1/users', { method: 'POST', body: parsed.data });
  } catch (err) {
    return { error: (err as ApiError).message };
  }
  revalidatePath('/admin/users');
  return { ok: `created ${parsed.data.email}` };
}

const RoleBody = z.object({
  user_id: z.string().min(1),
  org_role: z.enum(['admin', 'developer', 'reader']),
});

export async function changeUserRoleAction(formData: FormData): Promise<void> {
  const parsed = RoleBody.safeParse({
    user_id: formData.get('user_id'),
    org_role: formData.get('org_role'),
  });
  if (!parsed.success) return;
  try {
    await api(`/v1/users/${parsed.data.user_id}/org-role`, {
      method: 'PATCH',
      body: { org_role: parsed.data.org_role },
    });
  } catch {
    /* surfaced via revalidatePath refresh */
  }
  revalidatePath('/admin/users');
}

export async function removeUserAction(formData: FormData): Promise<void> {
  const user_id = String(formData.get('user_id') ?? '');
  if (!user_id) return;
  try {
    await api(`/v1/users/${user_id}`, { method: 'DELETE' });
  } catch {
    /* surfaced via revalidatePath refresh */
  }
  revalidatePath('/admin/users');
}
