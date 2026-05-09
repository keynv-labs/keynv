import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import Link from 'next/link';
import { AddMemberForm, RemoveMemberButton } from './forms';

interface Member {
  user_id: string;
  email: string;
  role: string;
  granted_at: string;
}

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, membersResp] = await Promise.all([
    api<{ name: string }>(`/v1/projects/${id}`),
    api<{ members: Member[] }>(`/v1/projects/${id}/members`),
  ]);

  return (
    <div>
      <div className="mb-6">
        <Link
          href={{ pathname: `/projects/${id}` }}
          className="text-xs text-[var(--color-fg-muted)]"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold mt-1">Members</h1>
      </div>

      <Card className="mb-6">
        <h2 className="text-base font-semibold mb-3">Add member</h2>
        <AddMemberForm projectId={id} />
      </Card>

      <Card>
        <h2 className="text-base font-semibold mb-3">
          Current members ({membersResp.members.length})
        </h2>
        {membersResp.members.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">No members yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--color-fg-muted)]">
              <tr>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Granted</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {membersResp.members.map((m) => (
                <tr key={m.user_id} className="border-t border-[var(--color-border)]">
                  <td className="py-2">{m.email}</td>
                  <td className="py-2 mono">{m.role}</td>
                  <td className="py-2 text-[var(--color-fg-muted)]">
                    {new Date(m.granted_at).toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    <RemoveMemberButton projectId={id} userId={m.user_id} email={m.email} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
