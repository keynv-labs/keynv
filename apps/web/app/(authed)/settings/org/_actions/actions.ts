'use server';

import { type ActionState, catchApi } from '@/lib/action-result';
import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';

export type OrgState = ActionState;

export async function updateOrgAction(_prev: OrgState, formData: FormData): Promise<OrgState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Organization name is required.' };

  const result = await catchApi(() =>
    api('/v1/org', {
      method: 'PATCH',
      body: { name },
    }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath('/settings/org');
  return { ok: `Organization renamed to "${name}".` };
}
