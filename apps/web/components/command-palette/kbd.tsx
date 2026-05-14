import type { ComponentProps, ReactNode } from 'react';

export function KbdGroup({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1">{children}</span>;
}

export function Kbd({ children, ...rest }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-border bg-bg px-1 font-mono text-[10px] text-fg-muted"
      {...rest}
    >
      {children}
    </kbd>
  );
}
