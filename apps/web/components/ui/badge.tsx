import { cn } from '@/lib/cn';
import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'env-dev' | 'env-stg' | 'env-prod';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children: ReactNode;
}

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-bg-elevated border-border text-fg-muted',
  success:
    'bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] border-[color-mix(in_oklab,var(--color-success)_30%,var(--color-border))] text-success',
  warn: 'bg-[color-mix(in_oklab,var(--color-warn)_14%,transparent)] border-[color-mix(in_oklab,var(--color-warn)_30%,var(--color-border))] text-warn',
  danger:
    'bg-[color-mix(in_oklab,var(--color-danger)_14%,transparent)] border-[color-mix(in_oklab,var(--color-danger)_30%,var(--color-border))] text-danger',
  'env-dev': 'bg-env-dev-bg border-env-dev-border text-env-dev-fg',
  'env-stg': 'bg-env-stg-bg border-env-stg-border text-env-stg-fg',
  'env-prod': 'bg-env-prod-bg border-env-prod-border text-env-prod-fg',
};

export function Badge({ tone = 'neutral', className, children, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5',
        'text-[11px] font-medium uppercase tracking-wider',
        toneStyles[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/** Maps a tier string ("dev", "staging", "prod", etc.) to a Badge tone. */
export function envTone(tier: string): Tone {
  const t = tier.toLowerCase();
  if (t === 'prod' || t === 'production') return 'env-prod';
  if (t === 'stg' || t === 'staging') return 'env-stg';
  return 'env-dev';
}
