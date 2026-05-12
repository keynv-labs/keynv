import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-accent text-fg-on-accent shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_8px_24px_-12px_rgba(255,183,77,0.7)] hover:bg-accent-hover hover:-translate-y-px active:bg-accent-pressed active:translate-y-0',
  secondary:
    'bg-bg-elevated border border-border text-fg hover:bg-bg-elevated-hover hover:border-border-strong',
  outline:
    'border border-border-strong text-fg hover:border-border-bright hover:bg-bg-elevated/50 bg-transparent',
  ghost: 'text-fg-muted hover:text-fg hover:bg-bg-elevated-hover',
  danger:
    'bg-danger text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset] hover:opacity-90 active:opacity-95',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2 font-medium',
};

export function Button({ variant = 'primary', size = 'md', className, ...rest }: Props) {
  return (
    <button
      type={rest.type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',
        'transition-all duration-fast ease-snap',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...rest}
    />
  );
}
