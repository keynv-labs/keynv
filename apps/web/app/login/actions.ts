'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { api, type ApiError } from '@/lib/api';
import { setSession } from '@/lib/session';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string; org_id: string; org_role: string };
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = Body.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });
  if (!parsed.success) {
    return { error: 'Email and password are required.' };
  }

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

  const next = parsed.data.next && parsed.data.next.startsWith('/') ? parsed.data.next : '/projects';
  redirect(next);
}
