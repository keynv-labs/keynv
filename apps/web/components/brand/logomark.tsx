import { cn } from '@/lib/cn';

interface Props {
  size?: number;
  className?: string;
  /** When true, renders just the glyph (no wordmark). */
  iconOnly?: boolean;
  /** Wordmark text size in px. Defaults to scale with `size`. */
  wordmarkClassName?: string;
}

/**
 * keynv logomark — a square chip framing a custom "k" glyph drawn as
 * three crisp strokes (vertical bar + two diagonals) plus a single
 * indicator dot in the upper-right that doubles as a "live/active"
 * signal. The amber stroke against the deep slate chip is the single
 * most repeated brand element across the app, so it is centralized here.
 */
export function Logomark({ size = 24, className, iconOnly, wordmarkClassName }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        role="img"
        aria-label="keynv"
        className="shrink-0"
        fill="none"
      >
        <rect width="32" height="32" rx="6" fill="var(--color-bg-inset)" />
        <rect
          x="0.5"
          y="0.5"
          width="31"
          height="31"
          rx="5.5"
          stroke="var(--color-accent-soft-border)"
        />
        <path
          d="M9 7 L9 25 M9 17 L17 9 M9 17 L17 25"
          stroke="var(--color-accent)"
          strokeWidth="2.4"
          strokeLinecap="square"
        />
        <circle cx="22.5" cy="9.5" r="1.5" fill="var(--color-accent)" />
      </svg>
      {iconOnly ? null : (
        <span
          className={cn('font-semibold tracking-tight text-fg', wordmarkClassName ?? 'text-[15px]')}
        >
          keynv
        </span>
      )}
    </span>
  );
}
