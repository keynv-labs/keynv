import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';
import { cn } from '@/lib/cn';

export interface BreadcrumbSegment {
  label: string;
  /** Omit href for the current (last) segment. */
  href?: string;
  /** When true, renders the label in monospace (project IDs, aliases). */
  mono?: boolean;
}

interface Props {
  segments: BreadcrumbSegment[];
  className?: string;
}

export function Breadcrumb({ segments, className }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1.5 text-sm', className)}
    >
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        const labelClass = cn(
          segment.mono && 'font-mono text-[13px]',
          isLast ? 'text-fg' : 'text-fg-muted hover:text-fg transition-colors',
        );
        return (
          <Fragment key={`${segment.label}-${i}`}>
            {i > 0 ? (
              <ChevronRight size={12} className="shrink-0 text-fg-subtle" aria-hidden />
            ) : null}
            {segment.href && !isLast ? (
              <Link href={{ pathname: segment.href }} className={labelClass}>
                {segment.label}
              </Link>
            ) : (
              <span className={labelClass}>{segment.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
