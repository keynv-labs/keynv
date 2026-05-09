import { api } from '@/lib/api';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from './form';

interface HealthResponse {
  ok: boolean;
  capabilities?: { public_registration?: boolean };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextParam = params.next ?? '/projects';

  // Hit /v1/health to check whether this instance opted into public
  // registration. Self-host deployments default to off; keynv.dev sets
  // KEYNV_PUBLIC_REGISTRATION=true. If the flag is off we redirect to
  // /login with a query string so the login page can show a banner.
  let enabled = false;
  try {
    const health = await api<HealthResponse>('/v1/health', { authed: false });
    enabled = health.capabilities?.public_registration === true;
  } catch {
    // If the health probe itself fails the server is unreachable —
    // showing the form lets the user discover that fact via the
    // submit-time error rather than a misleading "registration disabled"
    // message. Better to err toward letting them try.
    enabled = true;
  }

  if (!enabled) {
    redirect('/login?reason=registration_disabled');
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
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
    </div>
  );
}
