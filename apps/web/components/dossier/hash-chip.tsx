import { cn } from '@/lib/cn';

interface Props {
  hash: string;
  /** Number of leading hex chars to render. Default 8. */
  length?: number;
  className?: string;
  /** Optional prefix label (e.g. `prev`, `tail`) for audit-chain context. */
  label?: string;
}

/**
 * Compact display for a SHA-256 (or other hex) hash. Used to visually
 * surface the audit chain throughout the marketing site — readers see
 * that the product really does emit hashes, not that they're left to
 * read about it abstractly.
 */
export function HashChip({ hash, length = 8, className, label }: Props) {
  const short = hash.slice(0, length);
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 rounded-sm border border-border bg-bg-overlay px-1.5 py-0.5 font-mono text-[11px]',
        className,
      )}
      title={hash}
    >
      {label ? <span className="text-fg-subtle">{label}</span> : null}
      <span className="text-fg-muted" aria-hidden>
        #
      </span>
      <span className="text-fg tracking-tight">{short}</span>
      <span aria-hidden className="text-fg-subtle">
        …
      </span>
    </span>
  );
}
