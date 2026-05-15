'use client';

import { Button } from '@/components/ui/button';

export function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-10 text-center">
      <p className="text-sm text-fg-muted">No secrets match those filters.</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="mt-3 h-auto px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent hover:underline"
      >
        clear filters
      </Button>
    </div>
  );
}
