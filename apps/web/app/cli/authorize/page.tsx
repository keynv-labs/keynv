import { Logomark } from '@/components/brand/logomark';
import { CsrfField, CsrfProvider } from '@/components/security/csrf-field';
import { Button } from '@/components/ui/button';
import { ErrorBlock } from '@/components/ui/error-block';
import { Input } from '@/components/ui/input';
import { SkipLink } from '@/components/ui/skip-link';
import { createCsrfToken } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authorizeCliAction } from './actions';

export default async function CliAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; authorized?: string; error?: string }>;
}) {
  const params = await searchParams;
  const code = params.code ?? '';
  const session = await getSession();

  if (!session) {
    const next = code ? `/cli/authorize?code=${encodeURIComponent(code)}` : '/cli/authorize';
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const csrfToken = createCsrfToken();

  return (
    <CsrfProvider token={csrfToken}>
      <SkipLink />
      <main
        id="main"
        className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      >
        <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
        <div aria-hidden className="absolute inset-0 bg-amber-glow pointer-events-none" />

        <section className="relative w-full max-w-md rounded-xl border border-border bg-bg-elevated p-6 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.6)]">
          <Link href={{ pathname: '/' }} className="inline-flex">
            <Logomark size={34} iconOnly />
          </Link>

          {params.authorized === '1' ? (
            <>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                CLI connected
              </p>
              <h1 className="display mt-2 text-2xl tracking-tight text-fg">
                Return to your terminal
              </h1>
              <p className="mt-3 text-sm leading-6 text-fg-muted">
                keynv is finishing login and will continue project setup from the CLI.
              </p>
            </>
          ) : (
            <>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">
                Signed in as {session.email}
              </p>
              <h1 className="display mt-2 text-2xl tracking-tight text-fg">Connect keynv CLI?</h1>
              <p className="mt-3 text-sm leading-6 text-fg-muted">
                This authorizes the terminal session that opened this page. No secret values are
                exposed to the browser.
              </p>

              {params.error ? (
                <ErrorBlock
                  message="The authorization code is invalid or expired. Run keynv again."
                  className="mt-5"
                />
              ) : null}

              <form action={authorizeCliAction} className="mt-6 space-y-4">
                <CsrfField />
                <label className="block">
                  <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-2">
                    CLI code
                  </span>
                  <Input
                    name="user_code"
                    required
                    defaultValue={code}
                    className="font-mono bg-bg focus:border-accent"
                    placeholder="ABCD-2345"
                  />
                </label>
                <Button type="submit" size="lg" className="w-full">
                  Authorize CLI
                </Button>
              </form>
            </>
          )}
        </section>
      </main>
    </CsrfProvider>
  );
}
