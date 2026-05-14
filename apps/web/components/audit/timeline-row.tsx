'use client';

import { cn } from '@/lib/cn';
import { ChevronDown } from 'lucide-react';
import { actorInitials, describeEvent, relativeTime } from './event';
import type { AuditEntry } from './types';

export function TimelineRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const description = describeEvent(entry.event_type, entry.payload);
  const initials = actorInitials(entry.actor_user_id, entry.actor_agent);
  const isSystem = entry.actor_user_id === null;

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
      >
        <span
          aria-hidden
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-semibold',
            isSystem
              ? 'border-border bg-bg-inset text-fg-muted'
              : 'border-border-strong bg-bg-inset text-fg',
          )}
        >
          {initials}
        </span>

        <div className="flex-1 min-w-0 text-sm text-fg leading-tight">
          <span className="font-mono text-[12px] text-fg-muted">
            {isSystem ? 'system' : entry.actor_user_id}
          </span>
          <span className="mx-1.5 text-fg-muted">{description.verb}</span>
          {description.subject ? (
            <span
              className={cn(
                description.subjectMono ? 'font-mono text-[13px]' : '',
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

        <ChevronDown
          size={14}
          className={cn(
            'shrink-0 text-fg-subtle transition-transform duration-fast ease-snap',
            expanded ? 'rotate-180 text-fg-muted' : 'rotate-0',
          )}
          strokeWidth={2}
        />
      </button>

      {expanded ? (
        <div className="px-4 pb-3 pt-1 border-t border-border bg-bg/40">
          <DetailRow label="Event">
            <span className="font-mono text-[12px] text-fg">{entry.event_type}</span>
          </DetailRow>
          <DetailRow label="Agent">
            <span className="font-mono text-[12px] text-fg-muted">{entry.actor_agent}</span>
          </DetailRow>
          <DetailRow label="Timestamp">
            <span className="text-[12px] text-fg-muted">{new Date(entry.ts).toLocaleString()}</span>
          </DetailRow>
          <DetailRow label="Payload">
            <pre className="font-mono text-[11px] text-fg-muted leading-relaxed whitespace-pre-wrap break-all">
              {entry.payload ? JSON.stringify(entry.payload, null, 2) : '—'}
            </pre>
          </DetailRow>
        </div>
      ) : null}
    </>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-1">
      <span className="w-20 shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle pt-1">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
