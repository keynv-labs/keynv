import { switchOrgAction } from '@/app/(authed)/actions';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { CreateOrgDialog } from '@/components/layout/create-org-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { CsrfField } from '@/components/security/csrf-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Building2, Check, Plus, Users } from 'lucide-react';
import { UpdateOrgForm } from './_components/form';

interface OrgSummary {
  id: string;
  name: string;
  created_at?: string;
}

interface OrgUser {
  id: string;
  email: string;
  org_role: string;
  created_at: string;
}

interface WhoamiResponse {
  org_id: string;
  org_name: string;
  org_role: string;
  orgs?: Array<{ id: string; name: string }>;
}

export default async function OrgSettingsPage() {
  const session = await getSession();
  const fallbackOrgId = session?.active_org_id || session?.org_id || '';

  const [orgsRes, usersRes, whoami] = await Promise.all([
    api<{ orgs: OrgSummary[] }>('/v1/org').catch(() => null),
    api<{ users: OrgUser[]; next_cursor: string | null }>('/v1/users', {
      query: { limit: 50 },
    }).catch(() => null),
    api<WhoamiResponse>('/v1/whoami').catch(() => null),
  ]);

  const activeOrgId = whoami?.org_id ?? fallbackOrgId;
  const activeOrgRole = whoami?.org_role ?? session?.org_role ?? 'reader';
  const orgs = mergeOrgLists(orgsRes?.orgs ?? [], whoami?.orgs ?? []);
  const currentOrg = orgs.find((o) => o.id === activeOrgId) ?? {
    id: activeOrgId,
    name: whoami?.org_name ?? activeOrgId,
  };
  const users = usersRes?.users ?? [];
  const hasMoreUsers = usersRes?.next_cursor != null;
  const canManage = activeOrgRole === 'owner' || activeOrgRole === 'admin';

  return (
    <div className="space-y-7 max-w-5xl">
      <Breadcrumb segments={[{ label: 'Settings', href: '/settings/account' }, { label: 'Org' }]} />

      <PageHeader
        eyebrow="workspace · organization"
        title={currentOrg.name || 'Organization'}
        description="Switch workspaces, create a new organization, and manage the active org without hunting through the sidebar."
        actions={
          <CreateOrgDialog>
            <Button className="gap-1.5">
              <Plus size={14} strokeWidth={2.25} />
              Create org
            </Button>
          </CreateOrgDialog>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <OrgSwitcherPanel orgs={orgs} activeOrgId={activeOrgId} />

        <div className="rounded-xl border border-border bg-bg-elevated p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
                Active organization
              </div>
              <h2 className="mt-2 display text-xl tracking-tight text-fg">{currentOrg.name}</h2>
            </div>
            <Badge tone={activeOrgRole === 'owner' ? 'accent' : 'neutral'}>{activeOrgRole}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoTile label="Members" value={`${users.length}${hasMoreUsers ? '+' : ''}`} />
            <InfoTile label="Connected orgs" value={String(orgs.length)} />
            <InfoTile label="Org id" value={currentOrg.id || '—'} mono wide />
            <InfoTile label="Created" value={formatDate(currentOrg.created_at)} wide />
          </div>
        </div>
      </section>

      {canManage ? (
        <UpdateOrgForm />
      ) : (
        <div className="rounded-lg border border-border bg-bg-elevated p-5 text-sm text-fg-muted">
          Only owners and admins can rename this organization. You can still create your own org and
          become its owner.
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Members{' '}
            <span className="tabular">
              ({users.length}
              {hasMoreUsers ? '+' : ''})
            </span>
          </h3>
          {canManage ? (
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
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
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

function OrgSwitcherPanel({ orgs, activeOrgId }: { orgs: OrgSummary[]; activeOrgId: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Organizations
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            Workspaces are isolated. Switch here before creating projects or inviting members.
          </p>
        </div>
        <Users size={16} strokeWidth={2} className="shrink-0 text-fg-subtle" />
      </div>

      <div className="divide-y divide-border">
        {orgs.map((org) => {
          const active = org.id === activeOrgId;
          return (
            <form key={org.id} action={switchOrgAction.bind(null, org.id)}>
              <CsrfField />
              <button
                type="submit"
                disabled={active}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-fast ease-snap disabled:cursor-default disabled:bg-accent-soft/30 hover:bg-bg-elevated-hover"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-inset text-fg-muted">
                  <Building2 size={16} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{org.name}</span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-fg-subtle">
                    {org.id}
                  </span>
                </span>
                {active ? <Check size={15} strokeWidth={2.25} className="text-accent" /> : null}
              </button>
            </form>
          );
        })}
      </div>

      <div className="border-t border-border bg-bg-inset/35 px-5 py-4">
        <CreateOrgDialog>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-border-strong">
              <Plus size={13} strokeWidth={2.25} />
            </span>
            Create a separate organization
          </button>
        </CreateOrgDialog>
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <div className="text-fg-subtle text-[11px]">{label}</div>
      <div className={mono ? 'text-fg font-mono text-xs break-all' : 'text-fg'}>{value}</div>
    </div>
  );
}

function mergeOrgLists(primary: OrgSummary[], fallback: Array<{ id: string; name: string }>) {
  const byId = new Map<string, OrgSummary>();
  for (const org of primary) byId.set(org.id, org);
  for (const org of fallback) {
    if (!byId.has(org.id)) byId.set(org.id, org);
  }
  return Array.from(byId.values());
}

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
