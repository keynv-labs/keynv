import { SectionHeader } from '@/components/layout/page-header';
import { Badge, envTone } from '@/components/ui/badge';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Users } from 'lucide-react';
import { AddMemberDialog, RemoveMemberAction } from './member-forms';

interface Member {
  user_id: string;
  email: string;
  role: string;
  granted_at: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  created_at: string;
  environments: Array<{
    id: string;
    name: string;
    tier: string;
    require_approval: boolean;
  }>;
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const roleTone = (role: string): 'success' | 'warn' | 'neutral' | 'accent' => {
  if (role === 'lead') return 'accent';
  if (role === 'developer') return 'success';
  return 'neutral';
};

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, membersResp] = await Promise.all([
    api<ProjectDetail>(`/v1/projects/${id}`),
    api<{ members: Member[] }>(`/v1/projects/${id}/members`),
  ]);

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ─── Members ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="members"
          count={membersResp.members.length}
          actions={<AddMemberDialog projectId={id} />}
        />

        {membersResp.members.length === 0 ? (
          <div className="rounded-xl border border-border bg-bg-elevated p-10 text-center">
            <Users
              size={20}
              className="mx-auto mb-3 text-fg-subtle"
              strokeWidth={1.75}
              aria-hidden
            />
            <p className="text-sm text-fg-muted">No members on this project yet.</p>
            <p className="text-xs text-fg-subtle mt-1.5">
              Add a teammate to grant them access. Roles control what they can read or write.
            </p>
          </div>
        ) : (
          <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
            {membersResp.members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
              >
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-strong bg-bg-inset font-mono text-[12px] font-semibold text-fg"
                >
                  {m.email.slice(0, 2).toUpperCase()}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-fg truncate">{m.email}</div>
                  <div className="text-[11px] text-fg-subtle mt-0.5 font-mono tabular">
                    joined {formatRelative(m.granted_at)}
                  </div>
                </div>

                <Badge tone={roleTone(m.role)}>{m.role}</Badge>

                <RemoveMemberAction projectId={id} userId={m.user_id} email={m.email} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── Environments ────────────────────────────────────────────────── */}
      <Card bezel>
        <CardEyebrow>environments</CardEyebrow>
        <p className="text-sm text-fg-muted -mt-1 mb-4">
          Environments isolate keys per stage. Production-tier environments support an{' '}
          <code className="text-accent">require_approval</code> flag that gates reads behind a lead
          / admin sign-off.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle border-b border-border bg-bg-inset/40">
                Name
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle border-b border-border bg-bg-inset/40 w-32">
                Tier
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle border-b border-border bg-bg-inset/40 w-40">
                Approval gate
              </th>
            </tr>
          </thead>
          <tbody>
            {project.environments.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-3 py-2.5 font-mono text-[13px] text-fg tabular">{e.name}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={envTone(e.tier)}>
                    {e.tier === 'production' ? 'production' : 'non-prod'}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  {e.require_approval ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">
                      required
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
                      not required
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ─── Project info ────────────────────────────────────────────────── */}
      <Card>
        <CardTitle>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Project info
        </CardTitle>
        <dl className="grid sm:grid-cols-2 gap-5 -mt-1">
          <InfoRow label="name" value={project.name} />
          <InfoRow label="id" value={project.id} mono />
          <InfoRow label="created" value={new Date(project.created_at).toLocaleString()} />
          <InfoRow label="environments" value={`${project.environments.length} configured`} />
        </dl>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm text-fg ${mono ? 'font-mono tabular text-[13px]' : ''} break-all`}
      >
        {value}
      </dd>
    </div>
  );
}
