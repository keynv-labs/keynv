import { Breadcrumb } from '@/components/layout/breadcrumb';
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
    <div className="space-y-6">
      <Breadcrumb segments={[{ label: 'Admin' }, { label: 'Users' }]} />

      <header>
        <h1 className="text-[22px] font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-fg-muted mt-1">
          Org members and their org-level role. Project-level membership is managed inside each
          project.
        </p>
      </header>

      <UsersClient users={users} currentUserId={session?.user_id ?? ''} />
    </div>
  );
}
