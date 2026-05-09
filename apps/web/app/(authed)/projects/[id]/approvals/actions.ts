'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { type ApiError, api } from '@/lib/api';

export interface GrantState {
  error?: string;
  ok?: string;
}

const GrantBody = z.object({
  project_id: z.string().min(1),
  approval_id: z.string().min(1),
  expires_in_seconds: z.coerce.number().int().positive().max(7 * 24 * 3600),
  reason: z.string().max(500).optional(),
});

export async function grantApprovalAction(
  _prev: GrantState,
  formData: FormData,
): Promise<GrantState> {
  const parsed = GrantBody.safeParse({
    project_id: formData.get('project_id'),
    approval_id: formData.get('approval_id'),
    expires_in_seconds: formData.get('expires_in_seconds'),
    reason: formData.get('reason') || undefined,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; '),
    };
  }
  try {
    await api(
      `/v1/projects/${parsed.data.project_id}/approvals/${parsed.data.approval_id}/grant`,
      {
        method: 'POST',
        body: {
          expires_in_seconds: parsed.data.expires_in_seconds,
          ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        },
      },
    );
  } catch (err) {
    return { error: (err as ApiError).message };
  }
  revalidatePath(`/projects/${parsed.data.project_id}/approvals`);
  return { ok: 'granted' };
}

const DenyBody = z.object({
  project_id: z.string().min(1),
  approval_id: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export async function denyApprovalAction(
  _prev: GrantState,
  formData: FormData,
): Promise<GrantState> {
  const parsed = DenyBody.safeParse({
    project_id: formData.get('project_id'),
    approval_id: formData.get('approval_id'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: 'Reason is required.' };
  }
  try {
    await api(`/v1/projects/${parsed.data.project_id}/approvals/${parsed.data.approval_id}/deny`, {
      method: 'POST',
      body: { reason: parsed.data.reason },
    });
  } catch (err) {
    return { error: (err as ApiError).message };
  }
  revalidatePath(`/projects/${parsed.data.project_id}/approvals`);
  return { ok: 'denied' };
}
