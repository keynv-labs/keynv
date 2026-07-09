import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function AdminSecurityPage() {
  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Admin' }, { label: 'Security' }]} />

      <PageHeader
        eyebrow="admin · security"
        title="Security"
        description="The dedicated security surface is not expanded yet, but the live admin controls already exist in the sections below."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card bezel>
          <CardEyebrow>organization</CardEyebrow>
          <CardTitle>Org controls</CardTitle>
          <p className="text-sm text-fg-muted leading-relaxed">
            Manage organization identity, active workspace context, and member visibility from org settings.
          </p>
          <Link href="/settings/org" className="mt-4 inline-flex text-sm text-accent hover:underline">
            Open organization settings
          </Link>
        </Card>

        <Card>
          <CardEyebrow>members</CardEyebrow>
          <CardTitle>User access</CardTitle>
          <p className="text-sm text-fg-muted leading-relaxed">
            Review org membership and roles for everyone who can reach this workspace.
          </p>
          <Link href="/admin/users" className="mt-4 inline-flex text-sm text-accent hover:underline">
            Open Users
          </Link>
        </Card>
      </div>
    </div>
  );
}
