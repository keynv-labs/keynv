'use server';

import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { email, passwordMin12, orgRole, orgId } from '@/lib/schemas';
import { type ActionState, parseOr, parseRaw, catchApi } from '@/lib/action-result';

export type UserActionState = ActionState;

const InviteBody = z.object({
  email,
  password: passwordMin12,
  org_role: orgRole,
  org_id: orgId.optional(),
});

export async function inviteUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const orgIdRaw = formData.get('org_id');
  const parsed = parseRaw(InviteBody, {
    email: formData.get('email'),
    password: formData.get('password'),
    org_role: formData.get('org_role'),
    ...(typeof orgIdRaw === 'string' && orgIdRaw ? { org_id: orgIdRaw } : {}),
  });
  if (!parsed.success) return parsed;

  const result = await catchApi(() =>
    api('/v1/users', { method: 'POST', body: parsed.data }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath('/admin/users');
  return { ok: `created ${parsed.data.email}` };
}

const RoleBody = z.object({
  user_id: z.string().min(1),
  org_role: orgRole,
});

export async function changeUserRoleAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const parsed = parseOr(RoleBody, formData, ['user_id', 'org_role']);
  if (!parsed.success) return parsed;

  const result = await catchApi(() =>
    api(`/v1/users/${parsed.data.user_id}/org-role`, {
      method: 'PATCH',
      body: { org_role: parsed.data.org_role },
    }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath('/admin/users');
  return { ok: `Role updated to ${parsed.data.org_role}` };
}

export async function removeUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const user_id = String(formData.get('user_id') ?? '');
  if (!user_id) return { error: 'User ID is required.' };

  const result = await catchApi(() =>
    api(`/v1/users/${user_id}`, { method: 'DELETE' }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath('/admin/users');
  return { ok: 'User removed.' };
}
