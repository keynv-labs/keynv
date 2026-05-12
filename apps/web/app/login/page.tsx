import { Stamp } from '@/components/dossier/stamp';
import { SkipLink } from '@/components/ui/skip-link';
import { getCapabilities } from '@/lib/capabilities';
import { ArrowLeft } from 'lucide-react';
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
    <div className="newsprint min-h-screen flex flex-col">
      <SkipLink />
      <header className="border-b-2 border-fg/90">
        <div className="border-b border-border">
          <div className="mx-auto max-w-4xl px-4 md:px-6 py-2 flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.22em] text-fg-muted">
            <span>VOL. I · ENTRY POINT</span>
            <span className="hidden sm:inline">CREDENTIALED ACCESS</span>
            <span>keynv.dev</span>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href={{ pathname: '/' }}
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted hover:text-fg"
          >
            <ArrowLeft size={13} strokeWidth={2} />
            Home
          </Link>
          {publicSignup ? (
            <Link
              href={{ pathname: '/register' }}
              className="text-[13px] text-fg-muted hover:text-fg hover:underline underline-offset-4"
            >
              No account yet?
            </Link>
          ) : null}
        </div>
      </header>

      <main id="main" className="flex-1 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <Stamp parts={['§ AUTHENTICATION', 'STAGE 01 — SIGN IN']} />
          <h1 className="font-display text-[clamp(2.5rem,6vw,3.5rem)] font-medium tracking-[-0.02em] leading-[1.0] mt-4">
            Sign in.
          </h1>
          <p className="font-sans text-[16px] leading-[1.55] text-fg-muted mt-3 max-w-[44ch]">
            Present your team credentials to continue to the vault.
          </p>

          <div className="mt-8 border-2 border-fg bg-bg-elevated p-6 shadow-[6px_6px_0_0_var(--color-redact)]">
            {params.reason === 'registration_disabled' ? (
              <p className="mb-4 border-l-4 border-warn pl-3 py-1.5 font-sans text-[14px] text-fg-muted italic">
                Public signup is disabled on this instance. Ask a workspace owner for an invite.
              </p>
            ) : null}
            <LoginForm next={nextParam} />
          </div>

          {publicSignup ? (
            <p className="mt-6 text-center font-sans text-[14px] text-fg-muted">
              New to keynv?{' '}
              <Link
                className="text-fg underline underline-offset-4 decoration-fg/50 hover:decoration-fg"
                href="/register"
              >
                File a new account
              </Link>
            </p>
          ) : null}

          <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
            INSTANCE — keynv.dev · ENCRYPTED OVER HTTPS
          </p>
        </div>
      </main>
    </div>
  );
}
