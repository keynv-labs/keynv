import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-accent text-fg-on-accent hover:bg-accent-hover active:bg-accent-pressed',
  secondary:
    'bg-bg-elevated border border-border text-fg hover:bg-bg-elevated-hover hover:border-border-strong',
  ghost: 'text-fg-muted hover:text-fg hover:bg-bg-elevated-hover',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
};

export function Button({ variant = 'primary', size = 'md', className, ...rest }: Props) {
  return (
    <button
      type={rest.type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',
        'transition-colors duration-fast ease-snap',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...rest}
    />
  );
}
