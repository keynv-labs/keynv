'use client';

import { Badge, envTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TestSecretDialog } from './test-dialog';

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

function parseAlias(alias: string): { env: string; keyName: string } {
  const parts = alias.replace(/^@/, '').split('.');
  return { env: parts[1] ?? '', keyName: parts.slice(2).join('.') };
}

export function StatusClient({
  projectId,
  environments,
  secrets,
}: {
  projectId: string;
  environments: Environment[];
  secrets: SecretRow[];
}) {
  const [search, setSearch] = useState('');

  const parsed = useMemo<ParsedSecret[]>(
    () =>
      secrets.map((s) => {
        const { env, keyName } = parseAlias(s.alias);
        return { ...s, env, keyName };
      }),
    [secrets],
  );

  const filtered = useMemo(() => {
    if (!search) return parsed;
    const q = search.toLowerCase();
    return parsed.filter((s) => s.alias.toLowerCase().includes(q));
  }, [parsed, search]);

  const envTier = (name: string) =>
    environments.find((e) => e.name === name)?.tier ?? 'non-production';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-bg-elevated p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg"
          >
            <Activity size={16} className="text-fg-muted" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-fg">Connection tester</div>
            <div className="text-xs text-fg-muted mt-0.5">
              Run a live test against any secret to confirm it still authenticates. Postgres / MySQL
              / Redis / SSH / HTTP. The plaintext value never leaves the server process — it lives
              in memory only for the duration of the test call.
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            strokeWidth={2}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter aliases…"
            className="pl-8"
          />
        </div>
        <div className="ml-auto text-xs text-fg-subtle tabular-nums">
          {filtered.length} of {parsed.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center text-sm text-fg-muted">
          {parsed.length === 0
            ? 'No secrets in this project. Add one in the Secrets tab to test it here.'
            : 'No secrets match that search.'}
        </div>
      ) : (
        <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {filtered.map((s) => (
            <li
              key={s.alias}
              className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
            >
              <Badge tone={envTone(envTier(s.env))}>{s.env}</Badge>

              <div className="flex-1 min-w-0">
                <div className="font-mono text-[13px] text-fg truncate">{s.alias}</div>
                <div className="text-[11px] text-fg-subtle mt-0.5 tabular-nums">v{s.version}</div>
              </div>

              <TestSecretDialog
                projectId={projectId}
                env={s.env}
                keyName={s.keyName}
                alias={s.alias}
                trigger={
                  <Button variant="secondary" size="sm" className="gap-1">
                    Test
                    <ChevronRight size={12} strokeWidth={2.25} />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
