import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function VaultPage() {
  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Vault' }]} />

      <PageHeader
        eyebrow="workspace · vault"
        title="Team Vault"
        description="Project secrets live under Projects. Use this page as the jump point into the parts of the vault you touch most."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card bezel>
          <CardEyebrow>projects</CardEyebrow>
          <CardTitle>Browse project vaults</CardTitle>
          <p className="text-sm text-fg-muted leading-relaxed">
            Open the full project list, inspect environments, and manage stored secrets per project.
          </p>
          <Link href="/projects" className="mt-4 inline-flex text-sm text-accent hover:underline">
            Open Projects
          </Link>
        </Card>

        <Card>
          <CardEyebrow>audit</CardEyebrow>
          <CardTitle>Review vault activity</CardTitle>
          <p className="text-sm text-fg-muted leading-relaxed">
            See who changed secrets, when they changed them, and which project the action belonged to.
          </p>
          <Link href="/audit" className="mt-4 inline-flex text-sm text-accent hover:underline">
            Open Audit log
          </Link>
        </Card>
      </div>
    </div>
  );
}
