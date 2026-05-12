'use client';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Authed-scope error boundary. Renders inside the dashboard shell so
 * the sidebar stays visible and the user can navigate elsewhere
 * without bouncing through the global boundary.
 */
export default function AuthedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== 'undefined' && error.digest) {
      console.warn('[keynv:authed] page error', { digest: error.digest });
    }
  }, [error.digest]);

  return (
    <ErrorState
      variant="error"
      title="Something went wrong loading this page"
      description={
        <>
          The server returned an unexpected error. The team has been notified via the server logs.
          Try again, or jump to another section using the sidebar.
        </>
      }
      digest={error.digest}
      actions={
        <>
          <Button onClick={reset} className="gap-1.5">
            <RefreshCw size={13} strokeWidth={2.25} />
            Try again
          </Button>
          <Link href={{ pathname: '/projects' }}>
            <Button variant="secondary" className="gap-1.5">
              Projects
              <ArrowRight size={13} strokeWidth={2.25} />
            </Button>
          </Link>
        </>
      }
    />
  );
}
