'use server';

import { type ApiError, api } from '@/lib/api';
import { revalidatePath } from 'next/cache';

export interface OrgState {
  error?: string;
  ok?: string;
}

export async function updateOrgAction(
  _prev: OrgState,
  formData: FormData,
): Promise<OrgState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Organization name is required.' };

  try {
    await api('/v1/org', {
      method: 'PATCH',
      body: { name },
    });
  } catch (err) {
    const e = err as ApiError;
    return { error: e.message || 'Failed to update organization.' };
  }

  revalidatePath('/settings/org');
  return { ok: `Organization renamed to "${name}".` };
}
