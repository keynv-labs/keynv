'use server';

import { type ApiError, api } from '@/lib/api';
import { setSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(256),
  org_name: z.string().min(1).max(64),
  next: z.string().optional(),
});

export interface RegisterState {
  error?: string;
}

interface RegisterResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string; org_id: string; org_role: string };
}

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = Body.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    org_name: formData.get('org_name'),
    next: formData.get('next'),
  });
  if (!parsed.success) {
    return { error: 'Email, organization name, and a 12+ character password are required.' };
  }

  let response: RegisterResponse;
  try {
    response = await api<RegisterResponse>('/v1/auth/register', {
      method: 'POST',
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        org_name: parsed.data.org_name,
      },
      authed: false,
    });
  } catch (err) {
    const e = err as ApiError;
    if (e.code === 'user.already_exists') {
      return { error: 'An account with this email already exists. Sign in instead.' };
    }
    if (e.code === 'rbac.denied') {
      return { error: 'Public registration is disabled on this instance.' };
    }
    if (e.code === 'rate_limited') {
      return { error: 'Too many signup attempts. Please wait a minute and try again.' };
    }
    if (e.code === 'validation.failed') {
      return { error: e.message || 'Some fields were invalid. Please check and try again.' };
    }
    return { error: e.message || 'Could not create your account. Please try again.' };
  }

  await setSession({
    user_id: response.user.id,
    email: response.user.email,
    org_id: response.user.org_id,
    org_role: response.user.org_role,
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    access_expires_at: new Date(Date.now() + response.expires_in * 1000).toISOString(),
  });

  const next = parsed.data.next?.startsWith('/') ? parsed.data.next : '/projects';
  redirect(next);
}
