import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { UsersClient } from './users-client';

interface OrgUser {
  id: string;
  email: string;
  org_role: string;
  created_at: string;
}

export default async function AdminUsersPage() {
  const [session, { users }] = await Promise.all([
    getSession(),
    api<{ users: OrgUser[] }>('/v1/users'),
  ]);

  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Admin' }, { label: 'Users' }]} />

      <PageHeader
        eyebrow="admin · org membership"
        title="Users"
        description="Org members and their org-level role. Project-level membership is managed inside each project."
      />

      <UsersClient users={users} currentUserId={session?.user_id ?? ''} />
    </div>
  );
}
