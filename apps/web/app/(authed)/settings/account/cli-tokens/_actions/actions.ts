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

export async function revokeCliTokenAction(
  _prev: Record<string, string>,
  formData: FormData,
): Promise<Record<string, string>> {
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'Missing token id.' };

  const result = await catchApi(() =>
    api(`/v1/cli-tokens/${id}`, { method: 'DELETE' }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath('/settings/account/cli-tokens');
  return { ok: 'Token revoked.' };
}

interface CliTokenRow {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

/** Server action: fetches next page of cli tokens older than the given created_at cursor. */
export async function loadMoreCliTokensAction(
  beforeCreatedAt: string,
): Promise<{ tokens: CliTokenRow[]; next_cursor: string | null }> {
  return api('/v1/cli-tokens', { query: { limit: 50, before_created_at: beforeCreatedAt } });
}
