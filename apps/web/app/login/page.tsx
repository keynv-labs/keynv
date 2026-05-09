import { Card, CardTitle } from '@/components/ui/card';
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
        <div className="text-center mb-6">
          <div className="text-2xl font-bold tracking-tight">keynv</div>
          <div className="text-xs text-[var(--color-fg-muted)] mt-1">
            AI-safe secrets management
          </div>
        </div>
        <Card>
          <CardTitle>Sign in</CardTitle>
          <LoginForm next={nextParam} />
        </Card>
      </div>
    </div>
  );
}
