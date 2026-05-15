'use server';

import { type ActionState, parseOr } from '@/lib/action-result';
import { type ApiError, api } from '@/lib/api';
import { requireCsrf } from '@/lib/csrf';
import { email, password } from '@/lib/schemas';
import { setSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const Body = z.object({
  email,
  password,
  next: z.string().optional(),
});

export type LoginState = ActionState;

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string; org_id: string; org_role: string };
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const csrf = requireCsrf(formData);
  if (csrf) return csrf;

  const parsed = parseOr(Body, formData, ['email', 'password', 'next']);
  if (!parsed.success) return { error: 'Email and password are required.' };

  let response: LoginResponse;
  try {
    response = await api<LoginResponse>('/v1/auth/login', {
      method: 'POST',
      body: { email: parsed.data.email, password: parsed.data.password },
      authed: false,
    });
  } catch (err) {
    const e = err as ApiError;
    if (e.status === 401) return { error: 'Invalid email or password.' };
    return { error: e.message || 'Login failed.' };
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

  const next = parsed.data.next?.startsWith('/') ? parsed.data.next : '/dashboard';
  redirect(next);
}
