'use server';

import { type ActionState, catchApi, parseOr } from '@/lib/action-result';
import { api } from '@/lib/api';
import { requireCsrf } from '@/lib/csrf';
import { z } from 'zod';

export type PasswordState = ActionState;

const Body = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(12, 'New password must be at least 12 characters'),
  confirm_password: z.string().min(1, 'Confirm your new password'),
});

export async function changePasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const csrf = requireCsrf(formData);
  if (csrf) return csrf;

  const parsed = parseOr(Body, formData, ['current_password', 'new_password', 'confirm_password']);
  if (!parsed.success) return parsed;

  if (parsed.data.new_password !== parsed.data.confirm_password) {
    return { error: 'New password and confirmation do not match.' };
  }
  if (parsed.data.new_password === parsed.data.current_password) {
    return { error: 'New password must differ from current.' };
  }

  const result = await catchApi(() =>
    api('/v1/auth/password', {
      method: 'POST',
      body: {
        current_password: parsed.data.current_password,
        new_password: parsed.data.new_password,
      },
    }),
  );
  if (!result.success) return { error: result.error };

  return { ok: 'Password updated. Other sessions have been signed out.' };
}
