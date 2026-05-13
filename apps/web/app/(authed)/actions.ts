'use server';

import { api } from '@/lib/api';
import { clearSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export async function dismissOnboardingAction(): Promise<void> {
  try {
    await api('/v1/onboarding/dismiss', { method: 'POST' });
  } catch {
    // best-effort: localStorage fallback handles the session if this fails
  }
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await api('/v1/auth/logout', {
        method: 'POST',
        body: { refresh_token: session.refresh_token },
      });
    } catch {
      // best-effort
    }
  }
  await clearSession();
  redirect('/login?toast=signed_out');
}
