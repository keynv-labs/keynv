'use server';

import { api } from '@/lib/api';

const MAX_AUDIT_EXPORT = 5000;

export async function exportAuditAction(format: 'csv' | 'json'): Promise<string> {
  const { entries } = await api<{ entries: Array<Record<string, unknown>> }>('/v1/audit', {
    query: { limit: MAX_AUDIT_EXPORT },
  });

  if (format === 'json') return JSON.stringify(entries, null, 2);

  const cols = ['id', 'ts', 'event_type', 'actor_user_id', 'actor_agent', 'payload'];
  const stringify = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    // payload is an object — String() would emit "[object Object]" and drop
    // the alias/key/env/version data the JSON export keeps (B5).
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };
  const csvEscape = (v: unknown) => {
    let s = stringify(v);
    // Neutralize spreadsheet formula injection: a cell beginning with = + - @
    // (or a leading tab/CR) is evaluated as a formula by Excel/Sheets. The
    // actor_agent column is attacker-controlled (the X-Keynv-Agent header), so
    // prefix such cells with a single quote before CSV-quoting (B3).
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = [cols.join(','), ...entries.map((e) => cols.map((c) => csvEscape(e[c])).join(','))];
  return rows.join('\n');
}
