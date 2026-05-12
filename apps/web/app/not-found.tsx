import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { getSession } from '@/lib/session';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default async function NotFound() {
  const session = await getSession();
  const homeHref = session ? '/dashboard' : '/';
  const homeLabel = session ? 'Open dashboard' : 'Back home';

  return (
    <ErrorState
      variant="not-found"
      title="We couldn't find that page"
      description={
        <>
          The URL may be mistyped, the resource may have been deleted, or this link expired. Head
          back and try from the dashboard.
        </>
      }
      actions={
        <Link href={{ pathname: homeHref }}>
          <Button className="gap-1.5">
            {homeLabel}
            <ArrowRight size={13} strokeWidth={2.25} />
          </Button>
        </Link>
      }
    />
  );
}
