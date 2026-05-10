import { log, note, select } from '@clack/prompts';
import type { ApiClient } from '../../client/http.js';
import { unwrap } from '../helpers/cancel.js';

interface AuditEntry {
  id: number;
  ts: string;
  actor_user_id: string | null;
  actor_agent: string;
  event_type: string;
  payload: Record<string, unknown>;
}

const COMMON_EVENT_TYPES = [
  'all',
  'auth.login',
  'auth.logout',
  'project.created',
  'project.deleted',
  'secret.created',
  'secret.read.allowed',
  'secret.read.denied',
  'secret.rotated',
  'secret.deleted',
  'member.added',
  'member.removed',
];

export async function runAuditFlow(client: ApiClient): Promise<void> {
  while (true) {
    const filter = unwrap(
      await select({
        message: 'Filter',
        options: COMMON_EVENT_TYPES.map((t) => ({ value: t, label: t })).concat([
          { value: '__back', label: '← Back' },
        ]),
      }),
    );
    if (filter === '__back') return;
    const query: Record<string, string | number | undefined> = { limit: 25 };
    if (filter !== 'all') query.event_type = filter;
    const data = await client.request<{ entries: AuditEntry[] }>('/v1/audit', { query });
    if (data.entries.length === 0) {
      log.info('No entries.');
      continue;
    }
    const lines = data.entries
      .map(
        (e) =>
          `#${e.id}  ${e.ts}  ${e.event_type}  by ${e.actor_user_id ?? 'system'} (${e.actor_agent})`,
      )
      .join('\n');
    note(lines, `Audit (${data.entries.length})`);
  }
}
