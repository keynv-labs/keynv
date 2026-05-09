'use server';

import { type ApiError, api } from '@/lib/api';

export interface VerifyState {
  ok?: boolean;
  checked?: number;
  broken_at_id?: number;
  reason?: string;
  error?: string;
}

export async function verifyChainAction(_prev: VerifyState, _fd: FormData): Promise<VerifyState> {
  try {
    const result = await api<{
      ok: boolean;
      checked: number;
      broken_at_id?: number;
      reason?: string;
    }>('/v1/audit/verify', { method: 'POST' });
    return result;
  } catch (err) {
    return { error: (err as ApiError).message };
  }
}
