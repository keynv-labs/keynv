import { cn } from '@/lib/cn';
import type { InputHTMLAttributes } from 'react';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-border bg-bg-inset px-3 text-sm text-fg',
        'placeholder:text-fg-subtle',
        'transition-colors duration-fast ease-snap',
        'hover:border-border-strong',
        'focus:border-border-bright focus:bg-bg focus:outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    />
  );
}
