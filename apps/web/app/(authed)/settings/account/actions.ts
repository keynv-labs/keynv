'use server';

import { type ApiError, api } from '@/lib/api';
import { z } from 'zod';

export interface PasswordState {
  error?: string;
  ok?: string;
}

const Body = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(12, 'New password must be at least 12 characters'),
  confirm_password: z.string().min(1, 'Confirm your new password'),
});

export async function changePasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = Body.safeParse({
    current_password: formData.get('current_password'),
    new_password: formData.get('new_password'),
    confirm_password: formData.get('confirm_password'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; '),
    };
  }
  if (parsed.data.new_password !== parsed.data.confirm_password) {
    return { error: 'New password and confirmation do not match.' };
  }
  if (parsed.data.new_password === parsed.data.current_password) {
    return { error: 'New password must differ from current.' };
  }
  try {
    await api('/v1/auth/password', {
      method: 'POST',
      body: {
        current_password: parsed.data.current_password,
        new_password: parsed.data.new_password,
      },
    });
  } catch (err) {
    return { error: (err as ApiError).message };
  }
  return { ok: 'Password updated. Other sessions have been signed out.' };
}
