import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function IntegrationsPage() {
  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Integrations' }]} />

      <PageHeader
        eyebrow="developer · integrations"
        title="Integrations"
        description="Entry points for CLI, browser authorization, and account-level tokens that connect keynv to developer workflows."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card bezel>
          <CardEyebrow>tokens</CardEyebrow>
          <CardTitle>CLI tokens</CardTitle>
          <p className="text-sm text-fg-muted leading-relaxed">
            Review and revoke account tokens used by local CLI sessions and automations.
          </p>
          <Link href="/settings/account/cli-tokens" className="mt-4 inline-flex text-sm text-accent hover:underline">
            Open CLI tokens
          </Link>
        </Card>

        <Card>
          <CardEyebrow>browser auth</CardEyebrow>
          <CardTitle>CLI authorize</CardTitle>
          <p className="text-sm text-fg-muted leading-relaxed">
            Browser-side approval flow used when the CLI asks a signed-in user to authorize access.
          </p>
          <Link href="/cli/authorize" className="mt-4 inline-flex text-sm text-accent hover:underline">
            Open authorize flow
          </Link>
        </Card>

        <Card>
          <CardEyebrow>docs</CardEyebrow>
          <CardTitle>Setup guides</CardTitle>
          <p className="text-sm text-fg-muted leading-relaxed">
            Operator and developer docs for wiring keynv into apps, agents, and local tooling.
          </p>
          <Link href="/docs/quickstart" className="mt-4 inline-flex text-sm text-accent hover:underline">
            Open quickstart
          </Link>
        </Card>
      </div>
    </div>
  );
}
