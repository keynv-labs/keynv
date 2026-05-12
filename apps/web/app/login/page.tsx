import { Logomark } from '@/components/brand/logomark';
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
  const nextParam = params.next ?? '/dashboard';
  const { publicSignup } = await getCapabilities();

  return (
    <>
      <SkipLink />
      <main
        id="main"
        className="relative flex min-h-screen items-center justify-center p-6 overflow-hidden"
      >
        <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
        <div aria-hidden className="absolute inset-0 bg-amber-glow pointer-events-none" />

        <div className="relative w-full max-w-sm">
          <div className="text-center mb-9 animate-hero-rise">
            <Link href={{ pathname: '/' }} className="inline-flex">
              <Logomark size={36} iconOnly />
            </Link>
            <div className="display mt-4 text-2xl tracking-tight">keynv</div>
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">
              self-hosted · ai-safe by design
            </div>
          </div>

          <div
            className="rounded-xl border border-border bg-bg-elevated p-6 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.6)] animate-hero-rise"
            style={{ animationDelay: '80ms' }}
          >
            <h1 className="display text-lg tracking-tight text-fg">Sign in</h1>
            <p className="text-sm text-fg-muted mt-1.5">Enter your team credentials to continue.</p>
            {params.reason === 'registration_disabled' ? (
              <p className="mt-4 rounded-md border border-warn-soft-border bg-warn-soft px-3 py-2 text-[11px] text-warn">
                Public signup is disabled on this instance. Ask an admin to invite you.
              </p>
            ) : null}
            <LoginForm next={nextParam} />
          </div>

          {publicSignup ? (
            <p
              className="text-center text-xs text-fg-muted mt-5 animate-hero-rise"
              style={{ animationDelay: '160ms' }}
            >
              New to keynv?{' '}
              <Link className="text-accent hover:underline" href="/register">
                Create an account
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
