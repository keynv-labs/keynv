'use client';

import { Toaster as SonnerToaster } from 'sonner';

/**
 * Application-wide toast mount. Mounted once at the root layout so
 * both public (login/register) and authenticated pages share the same
 * surface. Theming is driven by the app's CSS custom properties so
 * the toast looks native to our dark palette.
 */
export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      closeButton
      richColors={false}
      duration={4500}
      gap={8}
      offset={20}
      toastOptions={{
        classNames: {
          toast:
            'group rounded-lg border bg-bg-elevated text-fg shadow-xl backdrop-blur-md ' +
            'border-border data-[type=success]:border-success/40 ' +
            'data-[type=error]:border-danger/40 data-[type=info]:border-accent/40',
          title: 'text-sm font-medium leading-snug',
          description: 'text-xs text-fg-muted leading-relaxed mt-0.5',
          actionButton: 'rounded-md bg-accent text-fg-on-accent px-2 py-1 text-xs font-medium',
          cancelButton: 'rounded-md text-fg-muted hover:text-fg px-2 py-1 text-xs font-medium',
          closeButton:
            'bg-bg-elevated border-border text-fg-muted hover:text-fg hover:bg-bg-elevated-hover',
        },
      }}
    />
  );
}
