import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Tiny mono uppercase label rendered above the title — e.g. "project · billing-app". */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Mono identifier rendered to the right of the title (project IDs, hash heads). */
  id?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard dashboard page header. Centralizes the display-headline +
 * mono eyebrow + actions cluster so every authed page reads the same
 * across Projects, Audit, Settings, etc. Consumers compose it inline:
 *
 *   <PageHeader title="Projects" description="..." actions={<Button>...</Button>} />
 */
export function PageHeader({
  eyebrow,
  title,
  id,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex items-end justify-between gap-4 flex-wrap', className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="display-eyebrow mb-2">{eyebrow}</div> : null}
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="display text-[26px] md:text-[30px] tracking-tight text-fg">{title}</h1>
          {id ? (
            <code className="font-mono text-xs text-fg-subtle tabular truncate max-w-[40ch]">
              {id}
            </code>
          ) : null}
        </div>
        {description ? (
          <p className="text-sm text-fg-muted mt-2 max-w-2xl leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </header>
  );
}

interface SectionHeaderProps {
  title: ReactNode;
  count?: number;
  /** Anything rendered to the right of the title (filter chips, "view all" links). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Eyebrow-style section divider used to introduce list/table blocks
 * inside a page. Renders the title in the small mono uppercase voice.
 */
export function SectionHeader({ title, count, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="display-eyebrow text-fg flex items-center gap-2">
        <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
        {title}
        {typeof count === 'number' ? (
          <span className="text-fg-subtle tabular">{count.toLocaleString()}</span>
        ) : null}
      </h2>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Optional mono delta or context line ("+3 this week", "@billing.prod"). */
  hint?: ReactNode;
  className?: string;
}

/**
 * Stat card with the brand's mono numerals and amber underline accent.
 * Used in Projects index and per-project Overview rollups.
 */
export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-lg border border-border bg-bg-elevated p-4 overflow-hidden',
        'hover:border-border-strong transition-colors duration-fast ease-snap',
        className,
      )}
    >
      <div className="display-eyebrow">{label}</div>
      <div className="mt-3 text-[30px] font-semibold leading-none tracking-tight tabular text-fg">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
          {hint}
        </div>
      ) : null}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/0 to-transparent group-hover:via-accent/40 transition-colors duration-base ease-snap"
      />
    </div>
  );
}
