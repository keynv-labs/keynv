import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { UsersClient } from './_components/users-client';

interface OrgUser {
  id: string;
  email: string;
  org_role: string;
  created_at: string;
}

interface Whoami {
  orgs?: Array<{ id: string; name: string }>;
  org_name?: string;
}

export default async function AdminUsersPage() {
  const [session, usersPage, whoami] = await Promise.all([
    getSession(),
    api<{ users: OrgUser[]; next_cursor: string | null }>('/v1/users', {
      query: { limit: 50 },
    }),
    api<Whoami>('/v1/whoami').catch(() => ({}) as Whoami),
  ]);

  const activeOrgId = session?.active_org_id || session?.org_id || '';
  const orgs =
    whoami.orgs && whoami.orgs.length > 0
      ? whoami.orgs
      : [{ id: activeOrgId, name: whoami.org_name ?? activeOrgId }];

  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Admin' }, { label: 'Users' }]} />

      <PageHeader
        eyebrow="admin · org membership"
        title="Users"
        description="Org members and their org-level role. Project-level membership is managed inside each project."
      />

      <UsersClient
        users={usersPage.users}
        nextCursor={usersPage.next_cursor}
        currentUserId={session?.user_id ?? ''}
        orgs={orgs}
        activeOrgId={activeOrgId}
      />
    </div>
  );
}
