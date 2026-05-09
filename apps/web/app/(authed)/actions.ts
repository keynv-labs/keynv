'use server';

import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { clearSession, getSession } from '@/lib/session';

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
  redirect('/login');
}
