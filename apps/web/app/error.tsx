'use client';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Global error boundary. Reached when a server component throws above
 * (or instead of) the authed-scope boundary. The browser receives a
 * `digest` string that correlates with the server log entry; we never
 * surface the raw error message (it may carry a connection string, a
 * driver-leaked secret, etc.).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== 'undefined' && error.digest) {
      console.warn('[keynv] page error', { digest: error.digest });
    }
  }, [error.digest]);

  return (
    <ErrorState
      variant="error"
      title="Something went wrong"
      description={
        <>
          We hit an unexpected error rendering this page. The team has been notified via the server
          logs. Try again, and if it keeps happening share the reference ID below when you reach
          out.
        </>
      }
      digest={error.digest}
      actions={
        <>
          <Button onClick={reset} className="gap-1.5">
            <RefreshCw size={13} strokeWidth={2.25} />
            Try again
          </Button>
          <Link href={{ pathname: '/' }}>
            <Button variant="secondary" className="gap-1.5">
              <ArrowLeft size={13} strokeWidth={2.25} />
              Back home
            </Button>
          </Link>
        </>
      }
    />
  );
}
