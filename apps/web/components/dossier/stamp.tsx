import { cn } from '@/lib/cn';
import { Fragment } from 'react';

interface Props {
  /** Stamp segments rendered as MONO · MONO · MONO. Empty entries skipped. */
  parts: Array<string | null | undefined>;
  className?: string;
  /** Visual treatment. 'inline' is text-only; 'pill' adds a faint
   *  hairline border; 'rotate' adds a slight skew like an actual
   *  rubber stamp dropped on the page. */
  variant?: 'inline' | 'pill' | 'rotate';
}

/**
 * The classification stamp. Used to date the hero, mark exhibit
 * captions, and tag changelog releases. Always monospace, always
 * uppercase, always slightly small — it has to read like a thing
 * that was added by a process, not authored by a designer.
 */
export function Stamp({ parts, className, variant = 'inline' }: Props) {
  const clean = parts.filter((p): p is string => Boolean(p && p.length > 0));
  if (clean.length === 0) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-muted',
        variant === 'pill' && 'rounded-sm border border-border-strong bg-bg-elevated/60 px-2 py-1',
        variant === 'rotate' &&
          'rounded-sm border border-border-strong bg-bg-elevated/60 px-2 py-1 -rotate-1 origin-left',
        className,
      )}
    >
      {clean.map((part, i) => (
        <Fragment key={`${i}-${part}`}>
          {i > 0 && (
            <span aria-hidden className="text-fg-subtle">
              ·
            </span>
          )}
          <span>{part}</span>
        </Fragment>
      ))}
    </div>
  );
}
