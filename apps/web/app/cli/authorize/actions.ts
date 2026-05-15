'use server';

import { type ApiError, api } from '@/lib/api';
import { requireCsrf } from '@/lib/csrf';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const Body = z.object({
  user_code: z.string().min(8).max(32),
});

function withCode(path: string, code: string): string {
  const params = new URLSearchParams({ code });
  return `${path}?${params.toString()}`;
}

export async function authorizeCliAction(formData: FormData): Promise<void> {
  const csrf = requireCsrf(formData);
  if (csrf) redirect('/cli/authorize?error=invalid');

  const parsed = Body.safeParse({ user_code: formData.get('user_code') });
  if (!parsed.success) redirect('/cli/authorize?error=invalid');

  try {
    await api('/v1/auth/cli/browser/authorize', {
      method: 'POST',
      body: { user_code: parsed.data.user_code },
      agentSuffix: 'cli-browser-authorize',
    });
  } catch (err) {
    const e = err as ApiError;
    const code = e.code === 'validation.failed' ? 'invalid' : 'failed';
    redirect(`${withCode('/cli/authorize', parsed.data.user_code)}&error=${code}`);
  }

  redirect('/cli/authorize?authorized=1');
}
