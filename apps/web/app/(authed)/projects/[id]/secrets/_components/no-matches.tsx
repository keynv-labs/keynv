'use client';

export function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-10 text-center">
      <p className="text-sm text-fg-muted">No secrets match those filters.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-accent hover:underline transition-colors duration-fast ease-snap"
      >
        clear filters
      </button>
    </div>
  );
}
