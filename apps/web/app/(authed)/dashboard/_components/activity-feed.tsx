import type { AuditEntry } from '@/components/audit/audit-timeline';
import { actorInitials, dayBucket, describeEvent, relativeTime } from '@/components/audit/event';
import { cn } from '@/lib/cn';

export function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  const grouped = new Map<string, { label: string; entries: AuditEntry[] }>();
  for (const e of entries) {
    const { key, label } = dayBucket(e.ts);
    const bucket = grouped.get(key);
    if (bucket) bucket.entries.push(e);
    else grouped.set(key, { label, entries: [e] });
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([key, { label, entries: dayEntries }]) => (
        <section key={key}>
          <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle flex items-center gap-2 mb-2">
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
            {label}
          </h3>
          <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
            {dayEntries.map((entry) => (
              <FeedRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FeedRow({ entry }: { entry: AuditEntry }) {
  const description = describeEvent(entry.event_type, entry.payload);
  const initials = actorInitials(entry.actor_user_id, entry.actor_agent);
  const isSystem = entry.actor_user_id === null;

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 animate-list-enter">
      <span
        aria-hidden
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-semibold',
          isSystem
            ? 'border-border bg-bg-inset text-fg-muted'
            : 'border-border-strong bg-bg-inset text-fg',
        )}
      >
        {initials}
      </span>
      <div className="flex-1 min-w-0 text-sm text-fg leading-tight truncate">
        <span className="font-mono text-[12px] text-fg-muted">
          {isSystem ? 'system' : entry.actor_user_id}
        </span>
        <span className="mx-1.5 text-fg-muted">{description.verb}</span>
        {description.subject ? (
          <span
            className={cn(
              description.subjectMono ? 'font-mono text-[12.5px]' : '',
              description.tone === 'danger' && 'text-danger',
              description.tone === 'warn' && 'text-warn',
              description.tone === 'success' && 'text-success',
              !description.tone && 'text-accent',
            )}
          >
            {description.subject}
          </span>
        ) : null}
      </div>
      <span
        className="shrink-0 font-mono text-[11px] tabular text-fg-subtle"
        title={new Date(entry.ts).toLocaleString()}
      >
        {relativeTime(entry.ts)}
      </span>
    </li>
  );
}
