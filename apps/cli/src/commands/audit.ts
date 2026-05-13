import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { handleExecError, table } from '../ui/format.js';

interface AuditEntry {
  id: number;
  ts: string;
  actor_user_id: string | null;
  actor_agent: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export class AuditListCommand extends Command {
  static override paths = [['audit', 'list']];
  static override usage = Command.Usage({
    description: 'List audit log entries.',
    examples: [
      ['Filter by event type', '$0 audit list --event-type secret.read.allowed --limit 50'],
    ],
  });

  eventType = Option.String('--event-type');
  limit = Option.String('--limit');
  sinceId = Option.String('--since-id');
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      const data = await client.request<{ entries: AuditEntry[]; next_cursor: number | null }>(
        '/v1/audit',
        {
          query: {
            event_type: this.eventType,
            limit: this.limit,
            since_id: this.sinceId,
          },
        },
      );
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
        return 0;
      }
      if (data.entries.length === 0) {
        this.context.stdout.write('no audit entries\n');
        return 0;
      }
      this.context.stdout.write(
        `${table(
          ['id', 'ts', 'actor', 'agent', 'event'],
          data.entries.map((e) => [
            String(e.id),
            e.ts,
            e.actor_user_id ?? '(none)',
            e.actor_agent,
            e.event_type,
          ]),
        )}\n`,
      );
      if (data.next_cursor) {
        this.context.stdout.write(`(next: --since-id ${data.next_cursor})\n`);
      }
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class AuditVerifyCommand extends Command {
  static override paths = [['audit', 'verify']];
  static override usage = Command.Usage({
    description: 'Walk the audit hash chain and report inconsistencies.',
  });
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      const data = await client.request<{
        ok: boolean;
        checked: number;
        broken_at_id?: number;
        reason?: string;
      }>('/v1/audit/verify', { method: 'POST' });
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
        return data.ok ? 0 : 1;
      }
      if (data.ok) {
        this.context.stdout.write(`OK: ${data.checked} entries verified\n`);
        return 0;
      }
      this.context.stdout.write(
        `FAIL: chain broken at id ${data.broken_at_id} (${data.reason}); ${data.checked} entries verified before break\n`,
      );
      return 1;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}
