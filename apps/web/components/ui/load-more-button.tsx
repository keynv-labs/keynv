'use client';

import { cn } from '@/lib/cn';
import { Loader2 } from 'lucide-react';

/**
 * Standard "load more" affordance used everywhere a list is cursor-paginated.
 * Caller manages cursor + loading state and calls back on click.
 */
export function LoadMoreButton({
  loading,
  onClick,
  label = 'load more',
}: {
  loading: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <div className="flex justify-center pt-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={cn(
          'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em]',
          'transition-colors duration-fast ease-snap',
          loading
            ? 'text-fg-subtle cursor-not-allowed'
            : 'text-fg-muted hover:text-fg hover:border-border-strong',
        )}
      >
        {loading ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            loading
          </>
        ) : (
          label
        )}
      </button>
    </div>
  );
}
