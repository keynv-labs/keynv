import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional small label printed above the note ("EX. 1", "CF.", "NOTE"). */
  label?: string;
  /** Note side; on small screens the note collapses inline below the
   *  parent regardless of this value. */
  side?: 'left' | 'right';
  className?: string;
}

/**
 * Editorial side annotation — small italic notes set in the wide
 * margins of a long passage, the way scholarly editions do it.
 *
 * The parent block needs `relative` (or `lg:relative`) so the
 * absolute positioning lands correctly. On screens narrower than `lg`
 * the note flows inline as a faint paragraph so nothing is lost.
 */
export function MarginNote({ children, label, side = 'right', className }: Props) {
  return (
    <aside
      className={cn(
        // small-screen fallback: inline under the parent
        'mt-3 max-w-md text-[12px] italic text-fg-subtle leading-snug',
        // wide-screen: absolute in the gutter
        'lg:absolute lg:mt-0 lg:w-48 lg:top-1',
        side === 'right' ? 'lg:-right-56' : 'lg:-left-56',
        'lg:not-italic',
        className,
      )}
    >
      {label ? (
        <div className="mb-1 font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-subtle">
          {label}
        </div>
      ) : null}
      <div className={cn('lg:border-l-2 lg:border-fg-subtle/40 lg:pl-3 lg:py-1 lg:italic')}>
        {children}
      </div>
    </aside>
  );
}
