'use server';

import { api } from '@/lib/api';

interface AuditEntry {
  id: number;
  ts: string;
  actor_user_id: string | null;
  actor_agent: string;
  event_type: string;
  payload: Record<string, unknown> | null;
}

export interface SecretHistoryState {
  entries?: AuditEntry[];
  error?: string;
}

/**
 * Loads the recent audit-chain entries for a specific alias. The audit
 * endpoint doesn't index by alias today, so we pull a window of recent
 * entries and filter client-side here on the server. Good enough for
 * the row-expand UX — anything older than the window lives in the full
 * audit page.
 */
export async function loadSecretHistoryAction(alias: string): Promise<SecretHistoryState> {
  try {
    const { entries } = await api<{ entries: AuditEntry[] }>('/v1/audit', {
      query: { limit: 200 },
    });
    const matched = entries.filter((e) => {
      const a = (e.payload as { alias?: string } | null)?.alias;
      return typeof a === 'string' && a === alias;
    });
    return { entries: matched.slice(0, 20) };
  } catch (err) {
    return { error: (err as Error).message || 'Could not load history.' };
  }
}
