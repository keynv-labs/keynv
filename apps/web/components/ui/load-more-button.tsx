'use client';

import { Loader2 } from 'lucide-react';
import { Button } from './button';

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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={loading}
        className="h-auto px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted"
      >
        {loading ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            loading
          </>
        ) : (
          label
        )}
      </Button>
    </div>
  );
}
