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
  return (
    <div className={cn('flex min-h-[60vh] items-center justify-center p-6', className)}>
      <div className="w-full max-w-md text-center">
        <div
          className={cn(
            'mx-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-elevated',
            VARIANT_TONE[variant],
          )}
        >
          <Icon size={20} strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-fg">{title}</h1>
        <div className="mt-2 text-sm text-fg-muted leading-relaxed">{description}</div>
        {digest ? (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 py-1 font-mono text-[11px] text-fg-subtle">
            <ScrollText size={11} strokeWidth={2} />
            ref {digest}
          </div>
        ) : null}
        {actions ? (
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
