import { cn } from '@/lib/cn';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** When true, adds a thin top-edge highlight for an etched-bezel feel. */
  bezel?: boolean;
}

export function Card({ children, className, bezel = false, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-border bg-bg-elevated p-5',
        bezel &&
          'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-border-strong before:to-transparent',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        'text-[15px] font-semibold mb-3 tracking-tight text-fg flex items-center gap-2',
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function CardEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-fg-subtle mb-2',
        className,
      )}
    >
      {children}
    </div>
  );
}
