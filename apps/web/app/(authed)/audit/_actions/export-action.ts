'use server';

import { api } from '@/lib/api';

const MAX_AUDIT_EXPORT = 5000;

export async function exportAuditAction(format: 'csv' | 'json'): Promise<string> {
  const { entries } = await api<{ entries: Array<Record<string, unknown>> }>('/v1/audit', {
    query: { limit: MAX_AUDIT_EXPORT },
  });

  if (format === 'json') return JSON.stringify(entries, null, 2);

  const cols = ['id', 'ts', 'event_type', 'actor_user_id', 'actor_agent', 'payload'];
  const csvEscape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = [cols.join(','), ...entries.map((e) => cols.map((c) => csvEscape(e[c])).join(','))];
  return rows.join('\n');
}
