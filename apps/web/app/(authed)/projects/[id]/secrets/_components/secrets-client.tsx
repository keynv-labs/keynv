'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CreateSecretDialog } from './secret-dialogs';
import { EmptyState } from './empty-state';
import { EnvTab } from './env-tab';
import { NoMatches } from './no-matches';
import { SecretsTable, type Environment, type ParsedSecret, type SecretRow } from './secrets-table';

interface Props {
  projectId: string;
  environments: Environment[];
  secrets: SecretRow[];
}

const ALL_ENVS = '__all__';
type EnvSelection = string;

function parseAlias(alias: string): { env: string; keyName: string } {
  const parts = alias.replace(/^@/, '').split('.');
  return {
    env: parts[1] ?? '',
    keyName: parts.slice(2).join('.'),
  };
}

export function SecretsClient({ projectId, environments, secrets }: Props) {
  const [activeEnv, setActiveEnv] = useState<EnvSelection>(ALL_ENVS);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedAlias, setExpandedAlias] = useState<string | null>(null);

  const parsed = useMemo<ParsedSecret[]>(
    () =>
      secrets.map((s) => {
        const { env, keyName } = parseAlias(s.alias);
        return { ...s, env, keyName };
      }),
    [secrets],
  );

  const countsByEnv = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of parsed) map.set(s.env, (map.get(s.env) ?? 0) + 1);
    return map;
  }, [parsed]);

  const filtered = useMemo(() => {
    return parsed.filter((s) => {
      if (activeEnv !== ALL_ENVS && s.env !== activeEnv) return false;
      if (search && !s.alias.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [parsed, activeEnv, search]);

  return (
    <div className="space-y-5">
      {/* ─── Env tabs ────────────────────────────────────────────────────── */}
      <nav
        aria-label="Filter by environment"
        className="-mx-4 px-4 md:-mx-8 md:px-8 border-b border-border overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex items-stretch gap-0 min-w-max">
          <EnvTab
            label="All"
            active={activeEnv === ALL_ENVS}
            count={parsed.length}
            onSelect={() => setActiveEnv(ALL_ENVS)}
          />
          {environments.map((env) => (
            <EnvTab
              key={env.name}
              label={env.name}
              tier={env.tier}
              active={activeEnv === env.name}
              count={countsByEnv.get(env.name) ?? 0}
              onSelect={() => setActiveEnv(env.name)}
            />
          ))}
        </ul>
      </nav>

      {/* ─── Toolbar: search + count + new ───────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
          >
            clear
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            <span className="text-fg tabular">{filtered.length}</span> of{' '}
            <span className="tabular">{parsed.length}</span>
          </span>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus size={14} strokeWidth={2.25} />
            New secret
          </Button>
        </div>
      </div>

      {/* ─── Table / Empty states ────────────────────────────────────────── */}
      {parsed.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : filtered.length === 0 ? (
        <NoMatches
          onClear={() => {
            setActiveEnv(ALL_ENVS);
            setSearch('');
          }}
        />
      ) : (
        <SecretsTable
          rows={filtered}
          environments={environments}
          projectId={projectId}
          expandedAlias={expandedAlias}
          onToggleExpand={(alias) => setExpandedAlias((curr) => (curr === alias ? null : alias))}
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

// ─── Env tab ─────────────────────────────────────────────────────────────────


