import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import Link from 'next/link';
import { CreateSecretForm, DeleteSecretButton, RotateSecretForm } from './forms';

interface SecretRow {
  alias: string;
  version: number;
  created_at: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  environments: Array<{ name: string; tier: string }>;
}

export default async function SecretsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, secretsResp] = await Promise.all([
    api<ProjectDetail>(`/v1/projects/${id}`),
    api<{ secrets: SecretRow[] }>(`/v1/projects/${id}/secrets`),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={{ pathname: `/projects/${id}` }}
            className="text-xs text-[var(--color-fg-muted)]"
          >
            ← {project.name}
          </Link>
          <h1 className="text-xl font-semibold mt-1">Secrets</h1>
        </div>
      </div>

      <Card className="mb-6">
        <h2 className="text-base font-semibold mb-3">Create secret</h2>
        <p className="text-xs text-[var(--color-fg-muted)] mb-3">
          The value is sent through this form to the keynv server, encrypted at rest, and never
          displayed back. To resolve a value, use <span className="mono">keynv exec</span> from the
          CLI.
        </p>
        <CreateSecretForm projectId={id} environments={project.environments.map((e) => e.name)} />
      </Card>

      <Card>
        <h2 className="text-base font-semibold mb-3">Aliases ({secretsResp.secrets.length})</h2>
        {secretsResp.secrets.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">No secrets yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--color-fg-muted)]">
              <tr>
                <th className="pb-2">Alias</th>
                <th className="pb-2">Version</th>
                <th className="pb-2">Created</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {secretsResp.secrets.map((s) => {
                const parts = s.alias.replace(/^@/, '').split('.');
                const env = parts[1] ?? '';
                const key = parts.slice(2).join('.');
                return (
                  <tr key={s.alias} className="border-t border-[var(--color-border)]">
                    <td className="py-2 mono">{s.alias}</td>
                    <td className="py-2">v{s.version}</td>
                    <td className="py-2 text-[var(--color-fg-muted)]">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2 items-center">
                        <RotateSecretForm projectId={id} env={env} keyName={key} />
                        <DeleteSecretButton projectId={id} env={env} keyName={key} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
