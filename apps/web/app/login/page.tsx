import { SkipLink } from '@/components/ui/skip-link';
import { getCapabilities } from '@/lib/capabilities';
import Link from 'next/link';
import { LoginForm } from './form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const nextParam = params.next ?? '/projects';
  const { publicSignup } = await getCapabilities();

  return (
    <>
      <SkipLink />
      <main id="main" className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent text-fg-on-accent text-base font-bold">
              k
            </div>
            <div className="text-2xl font-semibold tracking-tight mt-3">keynv</div>
            <div className="text-xs text-fg-muted mt-1">Self-hosted secrets, AI-safe by design</div>
          </div>

          <div className="rounded-xl border border-border bg-bg-elevated p-5">
            <h1 className="text-base font-semibold text-fg">Sign in</h1>
            <p className="text-sm text-fg-muted mt-1">Enter your team credentials to continue.</p>
            {params.reason === 'registration_disabled' ? (
              <p className="mt-3 rounded-md border border-border bg-bg-overlay px-3 py-2 text-[11px] text-fg-muted">
                Public signup is disabled on this instance. Ask an admin to invite you.
              </p>
            ) : null}
            <LoginForm next={nextParam} />
          </div>

          {publicSignup ? (
            <p className="text-center text-xs text-fg-muted mt-4">
              New to keynv?{' '}
              <Link className="text-fg hover:underline" href="/register">
                Create an account
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
