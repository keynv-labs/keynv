'use client';

import { Plus, Search, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, envTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { RowActions } from './row-actions';
import { CreateSecretDialog } from './secret-dialogs';

interface Environment {
  name: string;
  tier: string;
}

interface SecretRow {
  alias: string;
  version: number;
  created_at: string;
}

interface ParsedSecret extends SecretRow {
  env: string;
  keyName: string;
}

interface Props {
  projectId: string;
  environments: Environment[];
  secrets: SecretRow[];
}

function parseAlias(alias: string): { env: string; keyName: string } {
  const parts = alias.replace(/^@/, '').split('.');
  return {
    env: parts[1] ?? '',
    keyName: parts.slice(2).join('.'),
  };
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

export function SecretsClient({ projectId, environments, secrets }: Props) {
  const [activeEnvs, setActiveEnvs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const parsed = useMemo<ParsedSecret[]>(
    () =>
      secrets.map((s) => {
        const { env, keyName } = parseAlias(s.alias);
        return { ...s, env, keyName };
      }),
    [secrets],
  );

  const filtered = useMemo(() => {
    return parsed.filter((s) => {
      if (activeEnvs.size > 0 && !activeEnvs.has(s.env)) return false;
      if (search && !s.alias.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [parsed, activeEnvs, search]);

  function toggleEnv(name: string) {
    setActiveEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const isFiltering = activeEnvs.size > 0 || search.length > 0;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Secrets</h1>
          <p className="text-sm text-fg-muted mt-1">
            {parsed.length} {parsed.length === 1 ? 'alias' : 'aliases'} across{' '}
            {environments.length} {environments.length === 1 ? 'environment' : 'environments'}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus size={14} strokeWidth={2.25} />
          New secret
        </Button>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {environments.map((env) => {
            const active = activeEnvs.has(env.name);
            return (
              <button
                key={env.name}
                type="button"
                onClick={() => toggleEnv(env.name)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                  'transition-colors duration-fast ease-snap',
                  active
                    ? 'border-border-strong bg-bg-elevated-hover text-fg'
                    : 'border-border bg-bg-elevated text-fg-muted hover:text-fg hover:bg-bg-elevated-hover',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    env.tier === 'production'
                      ? 'bg-env-prod-fg'
                      : 'bg-env-dev-fg',
                  )}
                />
                {env.name}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            strokeWidth={2}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter aliases…"
            className="pl-8"
          />
        </div>

        {isFiltering ? (
          <button
            type="button"
            onClick={() => {
              setActiveEnvs(new Set());
              setSearch('');
            }}
            className="text-xs text-fg-muted hover:text-fg transition-colors duration-fast ease-snap"
          >
            Clear filters
          </button>
        ) : null}

        <div className="ml-auto text-xs text-fg-subtle tabular-nums">
          {filtered.length} of {parsed.length}
        </div>
      </div>

      {parsed.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : filtered.length === 0 ? (
        <NoMatches
          onClear={() => {
            setActiveEnvs(new Set());
            setSearch('');
          }}
        />
      ) : (
        <SecretsTable
          rows={filtered}
          environments={environments}
          projectId={projectId}
        />
      )}

      <CreateSecretDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        environments={environments.map((e) => e.name)}
      />
    </div>
  );
}

function SecretsTable({
  rows,
  environments,
  projectId,
}: {
  rows: ParsedSecret[];
  environments: Environment[];
  projectId: string;
}) {
  const envTier = (name: string) =>
    environments.find((e) => e.name === name)?.tier ?? 'non-production';

  return (
    <div className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <Th>Alias</Th>
            <Th className="w-28">Env</Th>
            <Th className="w-20">Version</Th>
            <Th className="w-44">Last rotated</Th>
            <Th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.alias}
              className="border-t border-border hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
            >
              <td className="px-4 py-3 font-mono text-[13px] text-fg">{s.alias}</td>
              <td className="px-4 py-3">
                <Badge tone={envTone(envTier(s.env))}>{s.env}</Badge>
              </td>
              <td className="px-4 py-3 text-fg-muted tabular-nums">v{s.version}</td>
              <td className="px-4 py-3 text-fg-muted">{formatRelative(s.created_at)}</td>
              <td className="px-2 py-3 text-right">
                <RowActions
                  projectId={projectId}
                  env={s.env}
                  keyName={s.keyName}
                  alias={s.alias}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle',
        'border-b border-border',
        className,
      )}
    >
      {children}
    </th>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center">
      <p className="text-sm text-fg-muted">No secrets match those filters.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 text-xs text-fg-muted hover:text-fg transition-colors duration-fast ease-snap"
      >
        Clear filters
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-10">
      <div className="mx-auto max-w-md text-center">
        <h2 className="text-base font-semibold text-fg">No secrets in this project yet</h2>
        <p className="text-sm text-fg-muted mt-2">
          Add one to start using <code className="font-mono text-fg">@&lt;project&gt;.&lt;env&gt;.&lt;key&gt;</code>{' '}
          references in your code. The keynv CLI resolves them inside a privileged subprocess your
          AI agent never sees.
        </p>

        <div className="mt-5 rounded-md border border-border bg-bg p-3 text-left">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            <Terminal size={12} />
            Example
          </div>
          <pre className="mt-2 font-mono text-[12px] text-fg-muted leading-relaxed">
            <span className="text-fg-subtle">$ </span>
            <span className="text-fg">keynv exec</span> -- pnpm dev{'\n'}
            <span className="text-fg-subtle">  </span>resolves{' '}
            <span className="text-fg">@&lt;this-project&gt;.dev.&lt;alias&gt;</span> into the
            subprocess
          </pre>
        </div>

        <div className="mt-6">
          <Button onClick={onCreate}>
            <Plus size={14} strokeWidth={2.25} />
            Add first secret
          </Button>
        </div>
      </div>
    </div>
  );
}
