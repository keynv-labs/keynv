import { cn } from '@/lib/cn';
import { AlertTriangle, Compass, ScrollText, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type Variant = 'error' | 'not-found' | 'forbidden';

const VARIANT_ICON: Record<Variant, typeof AlertTriangle> = {
  error: AlertTriangle,
  'not-found': Compass,
  forbidden: ShieldAlert,
};

const VARIANT_TONE: Record<Variant, string> = {
  error: 'text-danger',
  'not-found': 'text-fg-muted',
  forbidden: 'text-warn',
};

interface Props {
  variant?: Variant;
  title: string;
  description: ReactNode;
  /** Server-generated short identifier so support can correlate logs. */
  digest?: string | undefined;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared visual for error.tsx / not-found.tsx routes. Kept presentational —
 * no error logging, no router calls — so it can live in both server and
 * client error boundaries without forcing a "use client" boundary on the
 * caller.
 */
export function ErrorState({
  variant = 'error',
  title,
  description,
  digest,
  actions,
  className,
}: Props) {
  const Icon = VARIANT_ICON[variant];
  const variantBgClass =
    variant === 'error'
      ? 'border-danger-soft-border bg-danger-soft'
      : variant === 'forbidden'
        ? 'border-warn-soft-border bg-warn-soft'
        : 'border-border bg-bg-elevated';
  return (
    <div
      className={cn(
        'relative flex min-h-[60vh] items-center justify-center p-6 overflow-hidden',
        className,
      )}
    >
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
      <div className="relative w-full max-w-md text-center">
        <div
          className={cn(
            'mx-auto inline-flex h-12 w-12 items-center justify-center rounded-md border',
            variantBgClass,
            VARIANT_TONE[variant],
          )}
        >
          <Icon size={22} strokeWidth={2} />
        </div>
        <h1 className="mt-5 display text-2xl tracking-tight text-fg">{title}</h1>
        <div className="mt-3 text-sm text-fg-muted leading-relaxed">{description}</div>
        {digest ? (
          <div className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-inset px-2.5 py-1 font-mono text-[11px] text-fg-subtle tabular">
            <ScrollText size={11} strokeWidth={2} className="text-accent" />
            ref {digest}
          </div>
        ) : null}
        {actions ? (
          <div className="mt-7 flex items-center justify-center gap-2 flex-wrap">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
