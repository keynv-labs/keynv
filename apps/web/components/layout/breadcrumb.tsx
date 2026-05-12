import { cn } from '@/lib/cn';
import Link from 'next/link';
import { Fragment } from 'react';

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
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm', className)}>
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        const labelClass = cn(
          segment.mono && 'font-mono text-[12.5px] tabular',
          isLast ? 'text-fg font-medium' : 'text-fg-muted hover:text-fg transition-colors',
        );
        return (
          <Fragment key={`${segment.label}-${i}`}>
            {i > 0 ? (
              <span aria-hidden className="text-fg-subtle font-mono text-[11px]">
                /
              </span>
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
