import { cn } from '@/lib/cn';

export function GPrefixHint() {
  return (
    <output
      aria-live="polite"
      className={cn(
        'fixed bottom-4 right-4 z-30',
        'rounded-md border border-border-strong bg-bg-overlay px-3 py-2 text-xs text-fg shadow-lg',
        'animate-list-enter',
      )}
    >
      <span className="font-mono text-fg-muted">g</span>
      <span className="mx-1.5 text-fg-subtle">→</span>
      <span className="font-mono text-fg">h</span>
      <span className="text-fg-muted"> home</span>
      <span className="mx-2 text-fg-subtle">·</span>
      <span className="font-mono text-fg">p</span>
      <span className="text-fg-muted"> projects</span>
      <span className="mx-2 text-fg-subtle">·</span>
      <span className="font-mono text-fg">i</span>
      <span className="text-fg-muted"> inbox</span>
      <span className="mx-2 text-fg-subtle">·</span>
      <span className="font-mono text-fg">a</span>
      <span className="text-fg-muted"> audit</span>
      <span className="mx-2 text-fg-subtle">·</span>
      <span className="font-mono text-fg">s</span>
      <span className="text-fg-muted"> settings</span>
      <span className="mx-2 text-fg-subtle">·</span>
      <span className="font-mono text-fg">u</span>
      <span className="text-fg-muted"> users</span>
    </output>
  );
}
