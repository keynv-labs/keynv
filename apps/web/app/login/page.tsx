import { LoginForm } from './form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextParam = params.next ?? '/projects';

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
          <h1 className="text-base font-semibold text-fg">Sign in</h1>
          <p className="text-sm text-fg-muted mt-1">Enter your team credentials to continue.</p>
          <LoginForm next={nextParam} />
        </div>
      </div>
    </div>
  );
}
