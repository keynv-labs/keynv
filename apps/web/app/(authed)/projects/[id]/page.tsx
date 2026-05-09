import { ArrowUpRight, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, envTone } from '@/components/ui/badge';
import { type ApiError, api } from '@/lib/api';

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

  // Group secrets by environment for the per-env stat.
  const secretsByEnv = new Map<string, number>();
  for (const s of secretsResp.secrets) {
    const env = s.alias.replace(/^@/, '').split('.')[1] ?? '';
    secretsByEnv.set(env, (secretsByEnv.get(env) ?? 0) + 1);
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Secrets" value={secretsResp.secrets.length} />
        <Stat label="Environments" value={project.environments.length} />
        <Stat label="Members" value={membersResp.members.length} />
      </section>

      <section>
        <SectionHeader title="Environments">
          <span className="text-xs text-fg-subtle">{project.environments.length}</span>
        </SectionHeader>

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
                  <td className="px-4 py-3 font-mono text-[13px] text-fg">{e.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={envTone(e.tier)}>
                      {e.tier === 'production' ? 'production' : 'non-prod'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {e.require_approval ? (
                      <span className="inline-flex items-center gap-1.5 text-warn">
                        <ShieldCheck size={12} />
                        required
                      </span>
                    ) : (
                      <span>not required</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-fg-muted tabular-nums">
                    {secretsByEnv.get(e.name) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeader title="Members">
          <Link
            href={{ pathname: `/projects/${id}/members` }}
            className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg transition-colors duration-fast ease-snap"
          >
            View all
            <ArrowUpRight size={12} strokeWidth={2} />
          </Link>
        </SectionHeader>

        {membersResp.members.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-elevated p-6 text-sm text-fg-muted text-center">
            <Users
              size={18}
              className="mx-auto mb-2 text-fg-subtle"
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
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-elevated-hover text-[11px] font-semibold text-fg"
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-1 mb-2 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle border-b border-border ${className ?? ''}`}
    >
      {children}
    </th>
  );
}
