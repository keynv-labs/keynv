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

  // Self-host deployments default to no public signup. keynv.dev sets
  // KEYNV_PUBLIC_REGISTRATION=true. If a transient outage prevents us
  // from reading the flag we err toward rendering the form so the user
  // hits a real submit-time error rather than a misleading "disabled".
  const { publicSignup } = await getCapabilities({ fallback: { publicSignup: true } });
  if (!publicSignup) {
    redirect('/login?reason=registration_disabled');
  }

  return (
    <div className="newsprint min-h-screen">
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
            <h1 className="text-base font-semibold text-fg">Create your account</h1>
            <p className="text-sm text-fg-muted mt-1">
              Free during public beta. No credit card required.
            </p>
            <RegisterForm next={nextParam} />
          </div>

          <p className="text-center text-xs text-fg-muted mt-4">
            Already have an account?{' '}
            <Link className="text-fg hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
