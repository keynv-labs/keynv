import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md bg-bg-elevated-hover animate-pulse border border-border/40',
        className,
      )}
      {...rest}
    />
  );
}
