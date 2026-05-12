import { Logomark } from '@/components/brand/logomark';
import { SkipLink } from '@/components/ui/skip-link';
import { getCapabilities } from '@/lib/capabilities';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from './form';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextParam = params.next ?? '/projects';

  const { publicSignup } = await getCapabilities({ fallback: { publicSignup: true } });
  if (!publicSignup) {
    redirect('/login?reason=registration_disabled');
  }

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
            <h1 className="display text-lg tracking-tight text-fg">Create your account</h1>
            <p className="text-sm text-fg-muted mt-1.5">
              Free during public beta. No credit card required.
            </p>
            <RegisterForm next={nextParam} />
          </div>

          <p
            className="text-center text-xs text-fg-muted mt-5 animate-hero-rise"
            style={{ animationDelay: '160ms' }}
          >
            Already have an account?{' '}
            <Link className="text-accent hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
