'use client';

import { Button } from '@/components/ui/button';
import { Plus, Terminal } from 'lucide-react';

export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative rounded-xl border border-border bg-bg-elevated p-10 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
      <div className="relative mx-auto max-w-md text-center">
        <h2 className="display text-xl tracking-tight text-fg">No secrets yet</h2>
        <p className="text-sm text-fg-muted mt-3 leading-relaxed">
          Add one to start using{' '}
          <code className="text-accent">@&lt;project&gt;.&lt;env&gt;.&lt;key&gt;</code> references
          in your code. The keynv CLI resolves them inside a privileged subprocess your AI agent
          never sees.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-bg-inset p-4 text-left">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">
            <Terminal size={12} className="text-accent" />
            example
          </div>
          <pre className="mt-3 font-mono text-[12px] text-fg-muted leading-relaxed whitespace-pre-wrap break-words">
            <span className="text-fg-subtle">$ </span>
            <span className="text-fg">keynv exec</span> -- pnpm dev{'\n'}
            <span className="text-fg-subtle"> # </span>resolves{' '}
            <span className="text-accent">@&lt;this-project&gt;.dev.&lt;alias&gt;</span> into the
            subprocess
          </pre>
        </div>

        <div className="mt-7">
          <Button onClick={onCreate} className="gap-1.5">
            <Plus size={14} strokeWidth={2.25} />
            Add first secret
          </Button>
        </div>
      </div>
    </div>
  );
}
