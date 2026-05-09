import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-md bg-bg-elevated-hover animate-pulse', className)}
      {...rest}
    />
  );
}
