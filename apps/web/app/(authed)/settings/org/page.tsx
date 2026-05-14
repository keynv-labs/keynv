import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { UpdateOrgForm } from './_components/form';

interface OrgUser {
  id: string;
  email: string;
  org_role: string;
  created_at: string;
}

export default async function OrgSettingsPage() {
  const session = await getSession();
  const orgId = session?.active_org_id || session?.org_id || '';

  const [orgsRes, usersRes] = await Promise.all([
    api<{ orgs: Array<{ id: string; name: string; created_at: string }> }>('/v1/org').catch(() => null),
    api<{ users: OrgUser[]; next_cursor: string | null }>('/v1/users', {
      query: { limit: 50 },
    }).catch(() => null),
  ]);

  const currentOrg = orgsRes?.orgs.find((o) => o.id === orgId);
  const users = usersRes?.users ?? [];
  const hasMoreUsers = usersRes?.next_cursor != null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-fg">{currentOrg?.name ?? 'Organization'}</h2>
        <p className="text-sm text-fg-muted mt-1">
          Manage your organization — rename it, view members, and adjust org-level settings.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Organization info
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-fg-subtle text-[11px]">Name</div>
            <div className="text-fg">{currentOrg?.name ?? '—'}</div>
          </div>
          <div>
            <div className="text-fg-subtle text-[11px]">Members</div>
            <div className="text-fg">{users.length}</div>
          </div>
          {currentOrg?.created_at ? (
            <div className="col-span-2">
              <div className="text-fg-subtle text-[11px]">Created</div>
              <div className="text-fg">
                {new Date(currentOrg.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <UpdateOrgForm />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Members <span className="tabular">({users.length}{hasMoreUsers ? '+' : ''})</span>
          </h3>
          {session?.org_role === 'owner' || session?.org_role === 'admin' ? (
            <a
              href="/admin/users"
              className="text-xs text-accent hover:text-accent-strong transition-colors"
            >
              Manage users →
            </a>
          ) : null}
        </div>

        {users.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-elevated p-8 text-center text-sm text-fg-muted">
            No members yet.
          </div>
        ) : (
          <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-strong bg-bg-inset font-mono text-[11px] font-semibold text-fg"
                >
                  {u.email.slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-fg truncate">
                    {u.email}
                    {u.id === session?.user_id ? (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                        · you
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                    u.org_role === 'owner'
                      ? 'text-accent'
                      : u.org_role === 'admin'
                        ? 'text-fg'
                        : 'text-fg-subtle'
                  }`}
                >
                  {u.org_role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
