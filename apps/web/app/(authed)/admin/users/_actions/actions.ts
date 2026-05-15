'use server';

import { type ActionState, catchApi, parseOr, parseRaw } from '@/lib/action-result';
import { api } from '@/lib/api';
import { requireCsrf } from '@/lib/csrf';
import { email, orgId, orgRole, passwordMin12 } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type UserActionState = ActionState;

interface UserRow {
  id: string;
  email: string;
  org_role: string;
  created_at: string;
}

/** Server action: fetches next page of users older than the given created_at cursor. */
export async function loadMoreUsersAction(
  beforeCreatedAt: string,
): Promise<{ users: UserRow[]; next_cursor: string | null }> {
  return api('/v1/users', { query: { limit: 50, before_created_at: beforeCreatedAt } });
}

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
  const csrf = requireCsrf(formData);
  if (csrf) return csrf;

  const orgIdRaw = formData.get('org_id');
  const parsed = parseRaw(InviteBody, {
    email: formData.get('email'),
    password: formData.get('password'),
    org_role: formData.get('org_role'),
    ...(typeof orgIdRaw === 'string' && orgIdRaw ? { org_id: orgIdRaw } : {}),
  });
  if (!parsed.success) return parsed;

  const result = await catchApi(() => api('/v1/users', { method: 'POST', body: parsed.data }));
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
  const csrf = requireCsrf(formData);
  if (csrf) return csrf;

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
  const csrf = requireCsrf(formData);
  if (csrf) return csrf;

  const user_id = String(formData.get('user_id') ?? '');
  if (!user_id) return { error: 'User ID is required.' };

  const result = await catchApi(() => api(`/v1/users/${user_id}`, { method: 'DELETE' }));
  if (!result.success) return { error: result.error };

  revalidatePath('/admin/users');
  return { ok: 'User removed.' };
}
