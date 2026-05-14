'use server';

import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { cliTokenName } from '@/lib/schemas';
import { parseOr, catchApi } from '@/lib/action-result';

export type CreateTokenState = {
  error?: string;
  ok?: { id: string; name: string; token: string; expires_at: string | null };
};

const Body = z.object({
  name: cliTokenName,
});

export async function createCliTokenAction(
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  const parsed = parseOr(Body, formData, ['name']);
  if (!parsed.success) return parsed;

  const result = await catchApi(() =>
    api<{
      id: string;
      name: string;
      token: string;
      expires_at: string | null;
    }>('/v1/cli-tokens', {
      method: 'POST',
      body: { name: parsed.data.name },
    }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath('/settings/account/cli-tokens');
  return { ok: result.data };
}

export async function revokeCliTokenAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  try {
    await api(`/v1/cli-tokens/${id}`, { method: 'DELETE' });
  } catch {
    /* surfaced via revalidatePath refresh */
  }
  revalidatePath('/settings/account/cli-tokens');
}
