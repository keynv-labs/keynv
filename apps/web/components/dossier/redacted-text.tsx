'use client';

import { cn } from '@/lib/cn';
import { useState } from 'react';

interface Props {
  /** The phrase masked behind the bar. Set the prop, not children, so
   *  SSR can compute width without leaking the text to the DOM until
   *  reveal. */
  children: string;
  /** 'permanent'  — never reveals (use for hero theatrics)
   *  'hover'      — reveals on pointer hover / keyboard focus
   *  'click'      — toggles on click
   *  Default: 'hover' (matches the "click to declassify" archive idiom). */
  mode?: 'permanent' | 'hover' | 'click';
  className?: string;
  /** Visually-hidden phrase for assistive tech. Defaults to "redacted". */
  ariaLabel?: string;
}

/**
 * keynv's signature visual primitive — a black bar drawn over text.
 * Mirrors what the product literally does (redaction) and what
 * leaked-document archives typically look like.
 *
 * Always rendered client-side so 'hover' and 'click' modes can manage
 * the reveal state without hydration mismatch.
 */
export function RedactedText({
  children,
  mode = 'hover',
  className,
  ariaLabel = 'redacted',
}: Props) {
  const [revealed, setRevealed] = useState(false);

  if (mode === 'permanent') {
    return (
      <span className={cn('redact', className)} aria-label={ariaLabel} title={ariaLabel}>
        {children}
      </span>
    );
  }

  if (mode === 'click') {
    return (
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className={cn(
          revealed ? '' : 'redact',
          'redact-hover cursor-pointer bg-transparent border-0 p-0 m-0 font-inherit text-inherit',
          className,
        )}
        aria-label={revealed ? `${ariaLabel} — revealed` : ariaLabel}
        aria-pressed={revealed}
      >
        {children}
      </button>
    );
  }

  // hover (default) — button so keyboard users can also focus and reveal
  return (
    <button
      type="button"
      className={cn(
        'redact redact-hover bg-transparent border-0 p-0 m-0 font-inherit text-inherit',
        className,
      )}
      aria-label={ariaLabel}
      title="hover to reveal"
    >
      {children}
    </button>
  );
}
