'use client';

import { cn } from '@/lib/cn';

export function EnvTab({
  label,
  tier,
  active,
  count,
  onSelect,
}: {
  label: string;
  tier?: string;
  active: boolean;
  count: number;
  onSelect: () => void;
}) {
  const dotClass =
    tier === 'production'
      ? 'bg-env-prod-fg'
      : tier === 'staging'
        ? 'bg-env-stg-fg'
        : tier
          ? 'bg-env-dev-fg'
          : 'bg-fg-subtle/40';
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={cn(
          'group inline-flex items-center gap-2 px-3.5 py-2.5 -mb-px border-b-2',
          'transition-colors duration-fast ease-snap whitespace-nowrap',
          active
            ? 'border-accent text-fg'
            : 'border-transparent text-fg-muted hover:text-fg hover:border-border-strong',
        )}
      >
        {tier ? <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dotClass)} /> : null}
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn(
            'font-mono text-[11px] tabular px-1.5 py-0.5 rounded-sm border',
            active
              ? 'border-accent-soft-border bg-accent-soft text-accent'
              : 'border-border bg-bg-inset text-fg-subtle group-hover:text-fg-muted',
          )}
        >
          {count}
        </span>
      </button>
    </li>
  );
}
