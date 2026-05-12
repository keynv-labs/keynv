import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AuthedNotFound() {
  return (
    <ErrorState
      variant="not-found"
      title="We couldn't find that"
      description={
        <>
          That project, secret, or audit entry doesn&apos;t exist — or your role no longer has
          access to it. Try the projects list, or contact your workspace owner.
        </>
      }
      actions={
        <Link href={{ pathname: '/projects' }}>
          <Button className="gap-1.5">
            Back to projects
            <ArrowRight size={13} strokeWidth={2.25} />
          </Button>
        </Link>
      }
    />
  );
}
