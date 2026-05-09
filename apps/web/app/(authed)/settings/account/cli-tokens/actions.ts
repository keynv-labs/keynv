'use server';

import { type ApiError, api } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export interface CreateTokenState {
  /** Validation / API failure. */
  error?: string;
  /**
   * On success: the freshly issued token + metadata, returned exactly
   * once. The page renders this and the user copies it.
   */
  ok?: {
    id: string;
    name: string;
    token: string;
    expires_at: string | null;
  };
}

const Body = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/, 'Letters, digits, _ . - and spaces only'),
});

export async function createCliTokenAction(
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  const parsed = Body.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; '),
    };
  }
  try {
    const created = await api<{
      id: string;
      name: string;
      token: string;
      expires_at: string | null;
    }>('/v1/cli-tokens', {
      method: 'POST',
      body: { name: parsed.data.name },
    });
    revalidatePath('/settings/account/cli-tokens');
    return { ok: created };
  } catch (err) {
    return { error: (err as ApiError).message };
  }
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
