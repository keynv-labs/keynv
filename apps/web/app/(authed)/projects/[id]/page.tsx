import { SectionHeader, StatCard } from '@/components/layout/page-header';
import { Badge, envTone } from '@/components/ui/badge';
import { type ApiError, api } from '@/lib/api';
import { ArrowUpRight, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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

interface SecretRow {
  alias: string;
  version: number;
  created_at: string;
}

interface Member {
  user_id: string;
  email: string;
  role: string;
  granted_at: string;
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let project: ProjectDetail;
  try {
    project = await api<ProjectDetail>(`/v1/projects/${id}`);
  } catch (err) {
    if ((err as ApiError).status === 404) notFound();
    throw err;
  }

  const [secretsResp, membersResp] = await Promise.all([
    api<{ secrets: SecretRow[] }>(`/v1/projects/${id}/secrets`).catch(() => ({ secrets: [] })),
    api<{ members: Member[] }>(`/v1/projects/${id}/members`).catch(() => ({ members: [] })),
  ]);

  const secretsByEnv = new Map<string, number>();
  for (const s of secretsResp.secrets) {
    const env = s.alias.replace(/^@/, '').split('.')[1] ?? '';
    secretsByEnv.set(env, (secretsByEnv.get(env) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Secrets" value={secretsResp.secrets.length.toLocaleString()} />
        <StatCard label="Environments" value={project.environments.length.toLocaleString()} />
        <StatCard label="Members" value={membersResp.members.length.toLocaleString()} />
      </section>

      <section>
        <SectionHeader title="environments" count={project.environments.length} />

        <div className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th className="w-32">Tier</Th>
                <Th className="w-32">Approval</Th>
                <Th className="w-24 text-right">Secrets</Th>
              </tr>
            </thead>
            <tbody>
              {project.environments.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-border hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
                >
                  <td className="px-4 py-3 font-mono text-[13px] text-fg tabular">{e.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={envTone(e.tier)}>
                      {e.tier === 'production' ? 'production' : 'non-prod'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {e.require_approval ? (
                      <span className="inline-flex items-center gap-1.5 text-warn font-mono text-[10px] uppercase tracking-[0.14em]">
                        <ShieldCheck size={12} />
                        required
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
                        not required
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-fg-muted font-mono tabular">
                    {secretsByEnv.get(e.name) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeader
          title="members"
          count={membersResp.members.length}
          actions={
            <Link
              href={{ pathname: `/projects/${id}/members` }}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
            >
              view all
              <ArrowUpRight size={11} strokeWidth={2} />
            </Link>
          }
        />

        {membersResp.members.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-elevated p-8 text-sm text-fg-muted text-center">
            <Users
              size={20}
              className="mx-auto mb-3 text-fg-subtle"
              strokeWidth={1.75}
              aria-hidden
            />
            No members on this project yet.
          </div>
        ) : (
          <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
            {membersResp.members.slice(0, 5).map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-strong bg-bg-inset font-mono text-[11px] font-semibold text-fg"
                >
                  {m.email.slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-fg truncate">{m.email}</div>
                </div>
                <Badge tone="neutral">{m.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle border-b border-border bg-bg-inset/40 ${className ?? ''}`}
    >
      {children}
    </th>
  );
}
