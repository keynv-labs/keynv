import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-8 w-full rounded-md border border-border bg-bg px-2.5 text-sm text-fg',
        'placeholder:text-fg-subtle',
        'transition-colors duration-fast ease-snap',
        'hover:border-border-strong',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    />
  );
}
