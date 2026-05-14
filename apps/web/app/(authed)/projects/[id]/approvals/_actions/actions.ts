'use server';

import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { projectId, approvalReason, expiresInSeconds } from '@/lib/schemas';
import { type ActionState, parseOr, catchApi } from '@/lib/action-result';

export type GrantState = ActionState;

const GrantBody = z.object({
  project_id: projectId,
  approval_id: z.string().min(1),
  expires_in_seconds: expiresInSeconds,
  reason: approvalReason,
});

export async function grantApprovalAction(
  _prev: GrantState,
  formData: FormData,
): Promise<GrantState> {
  const parsed = parseOr(GrantBody, formData, ['project_id', 'approval_id', 'expires_in_seconds', 'reason']);
  if (!parsed.success) return parsed;

  const result = await catchApi(() =>
    api(`/v1/projects/${parsed.data.project_id}/approvals/${parsed.data.approval_id}/grant`, {
      method: 'POST',
      body: {
        expires_in_seconds: parsed.data.expires_in_seconds,
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      },
    }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath(`/projects/${parsed.data.project_id}/approvals`);
  return { ok: 'granted' };
}

const DenyBody = z.object({
  project_id: projectId,
  approval_id: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export async function denyApprovalAction(
  _prev: GrantState,
  formData: FormData,
): Promise<GrantState> {
  const parsed = parseOr(DenyBody, formData, ['project_id', 'approval_id', 'reason']);
  if (!parsed.success) return { error: 'Reason is required.' };

  const result = await catchApi(() =>
    api(`/v1/projects/${parsed.data.project_id}/approvals/${parsed.data.approval_id}/deny`, {
      method: 'POST',
      body: { reason: parsed.data.reason },
    }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath(`/projects/${parsed.data.project_id}/approvals`);
  return { ok: 'denied' };
}
