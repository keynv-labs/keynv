'use client';

import './globals.css';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.warn('[keynv] root error', { digest: error.digest });
    }
  }, [error.digest]);

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <ErrorState
          variant="error"
          title="Something broke at the root"
          description="The dashboard shell could not be rendered. Retry once; if it keeps failing, share the reference ID with support."
          digest={error.digest}
          actions={
            <Button onClick={reset} className="gap-1.5">
              <RefreshCw size={13} strokeWidth={2.25} />
              Try again
            </Button>
          }
        />
      </body>
    </html>
  );
}
