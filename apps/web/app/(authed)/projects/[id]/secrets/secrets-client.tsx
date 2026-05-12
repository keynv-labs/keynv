'use client';

import { describeEvent, relativeTime } from '@/components/audit/event';
import { Badge, envTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { ChevronRight, FileText, Loader2, Plus, Search, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { type SecretHistoryState, loadSecretHistoryAction } from './history-action';
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

const ALL_ENVS = '__all__';
type EnvSelection = string;

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
        className="-mx-4 px-4 md:-mx-8 md:px-8 border-b border-border overflow-x-auto"
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

function EnvTab({
  label,
  tier,
  active,
  count,
  onSelect,
}: {
  label: string;
  tier?: string;
  active: boolean;
  count: number;
  onSelect: () => void;
}) {
  const dotClass =
    tier === 'production'
      ? 'bg-env-prod-fg'
      : tier === 'staging'
        ? 'bg-env-stg-fg'
        : tier
          ? 'bg-env-dev-fg'
          : 'bg-fg-subtle/40';
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={cn(
          'group inline-flex items-center gap-2 px-3.5 py-2.5 -mb-px border-b-2',
          'transition-colors duration-fast ease-snap whitespace-nowrap',
          active
            ? 'border-accent text-fg'
            : 'border-transparent text-fg-muted hover:text-fg hover:border-border-strong',
        )}
      >
        {tier ? <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dotClass)} /> : null}
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn(
            'font-mono text-[11px] tabular px-1.5 py-0.5 rounded-sm border',
            active
              ? 'border-accent-soft-border bg-accent-soft text-accent'
              : 'border-border bg-bg-inset text-fg-subtle group-hover:text-fg-muted',
          )}
        >
          {count}
        </span>
      </button>
    </li>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

function SecretsTable({
  rows,
  environments,
  projectId,
  expandedAlias,
  onToggleExpand,
}: {
  rows: ParsedSecret[];
  environments: Environment[];
  projectId: string;
  expandedAlias: string | null;
  onToggleExpand: (alias: string) => void;
}) {
  const envTier = (name: string) =>
    environments.find((e) => e.name === name)?.tier ?? 'non-production';

  return (
    <div className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <Th className="w-8" />
            <Th>Alias</Th>
            <Th className="w-28">Env</Th>
            <Th className="w-20">Version</Th>
            <Th className="w-44">Last rotated</Th>
            <Th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const expanded = expandedAlias === s.alias;
            return (
              <SecretRowItem
                key={s.alias}
                secret={s}
                tier={envTier(s.env)}
                expanded={expanded}
                onToggle={() => onToggleExpand(s.alias)}
                projectId={projectId}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SecretRowItem({
  secret: s,
  tier,
  expanded,
  onToggle,
  projectId,
}: {
  secret: ParsedSecret;
  tier: string;
  expanded: boolean;
  onToggle: () => void;
  projectId: string;
}) {
  return (
    <>
      <tr
        className={cn(
          'border-t border-border transition-colors duration-fast ease-snap animate-list-enter',
          expanded ? 'bg-bg-elevated-hover' : 'hover:bg-bg-elevated-hover',
        )}
      >
        <td className="pl-3 pr-1 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${s.alias}` : `Expand ${s.alias}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:text-fg hover:bg-bg-inset transition-colors duration-fast ease-snap"
          >
            <ChevronRight
              size={13}
              strokeWidth={2}
              className={cn(
                'transition-transform duration-fast ease-snap',
                expanded ? 'rotate-90 text-accent' : 'rotate-0',
              )}
            />
          </button>
        </td>
        <td className="px-4 py-3 font-mono text-[13px] text-fg tabular">
          <button
            type="button"
            onClick={onToggle}
            className="text-left hover:text-accent transition-colors duration-fast ease-snap"
          >
            <span className="text-accent">@</span>
            {s.alias.replace(/^@/, '')}
          </button>
        </td>
        <td className="px-4 py-3">
          <Badge tone={envTone(tier)}>{s.env}</Badge>
        </td>
        <td className="px-4 py-3 text-fg-muted font-mono tabular text-[12px]">v{s.version}</td>
        <td className="px-4 py-3 text-fg-muted text-[12px]">{formatRelative(s.created_at)}</td>
        <td className="px-2 py-3 text-right">
          <RowActions projectId={projectId} env={s.env} keyName={s.keyName} alias={s.alias} />
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-bg-inset/40 animate-list-enter">
          <td colSpan={6} className="px-12 py-5 border-t border-border">
            <SecretHistoryPanel alias={s.alias} projectId={projectId} secret={s} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

// ─── History panel ───────────────────────────────────────────────────────────

function SecretHistoryPanel({
  alias,
  projectId,
  secret,
}: {
  alias: string;
  projectId: string;
  secret: ParsedSecret;
}) {
  const [state, setState] = useState<SecretHistoryState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSecretHistoryAction(alias)
      .then((result) => {
        if (!cancelled) {
          setState(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ error: (err as Error).message || 'Could not load history.' });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [alias]);

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
      {/* History timeline */}
      <div>
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-3 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
          recent history
        </div>
        {loading || state === null ? (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Loader2 size={12} className="animate-spin" />
            Loading recent events…
          </div>
        ) : state.error ? (
          <div className="text-xs text-danger">{state.error}</div>
        ) : (state.entries?.length ?? 0) === 0 ? (
          <div className="text-xs text-fg-muted">
            No recent events for this alias in the last 200 audit entries.{' '}
            <Link
              href={{ pathname: `/projects/${projectId}/audit`, query: { alias } }}
              className="text-accent hover:underline"
            >
              View full audit ↗
            </Link>
          </div>
        ) : (
          <ol className="space-y-2.5">
            {state.entries?.map((e) => {
              const description = describeEvent(e.event_type, e.payload);
              return (
                <li key={e.id} className="flex items-start gap-3 text-xs">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 rounded-full shrink-0',
                      description.tone === 'danger'
                        ? 'bg-danger'
                        : description.tone === 'warn'
                          ? 'bg-warn'
                          : description.tone === 'success'
                            ? 'bg-success'
                            : 'bg-accent',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-fg">
                      <span className="font-mono text-fg-muted">{e.actor_user_id ?? 'system'}</span>
                      <span className="mx-1.5 text-fg-muted">{description.verb}</span>
                      <span className="font-mono text-accent">{alias}</span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 font-mono text-[10px] tabular text-fg-subtle"
                    title={new Date(e.ts).toLocaleString()}
                  >
                    {relativeTime(e.ts)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <div className="mt-4">
          <Link
            href={{ pathname: `/projects/${projectId}/audit`, query: { alias } }}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
          >
            <FileText size={11} strokeWidth={2} />
            full audit for this alias →
          </Link>
        </div>
      </div>

      {/* Metadata sidebar */}
      <aside className="space-y-3">
        <Meta label="Version" value={`v${secret.version}`} mono />
        <Meta label="Created" value={new Date(secret.created_at).toLocaleString()} />
        <Meta label="Key" value={secret.keyName} mono />
        <Meta label="Environment" value={secret.env} mono />
        <div className="pt-2">
          <code className="block rounded border border-border bg-bg-inset px-2.5 py-1.5 font-mono text-[11px] text-fg tabular break-all">
            <span className="text-fg-subtle">$ </span>keynv exec --{' '}
            <span className="text-accent">{alias}</span>
          </code>
        </div>
      </aside>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </div>
      <div className={cn('mt-0.5 text-xs text-fg', mono ? 'font-mono tabular' : '')}>{value}</div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle',
        'border-b border-border bg-bg-inset/40',
        className,
      )}
    >
      {children}
    </th>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-10 text-center">
      <p className="text-sm text-fg-muted">No secrets match those filters.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-accent hover:underline transition-colors duration-fast ease-snap"
      >
        clear filters
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative rounded-xl border border-border bg-bg-elevated p-10 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
      <div className="relative mx-auto max-w-md text-center">
        <h2 className="display text-xl tracking-tight text-fg">No secrets yet</h2>
        <p className="text-sm text-fg-muted mt-3 leading-relaxed">
          Add one to start using{' '}
          <code className="text-accent">@&lt;project&gt;.&lt;env&gt;.&lt;key&gt;</code> references
          in your code. The keynv CLI resolves them inside a privileged subprocess your AI agent
          never sees.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-bg-inset p-4 text-left">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">
            <Terminal size={12} className="text-accent" />
            example
          </div>
          <pre className="mt-3 font-mono text-[12px] text-fg-muted leading-relaxed whitespace-pre-wrap break-words">
            <span className="text-fg-subtle">$ </span>
            <span className="text-fg">keynv exec</span> -- pnpm dev{'\n'}
            <span className="text-fg-subtle"> # </span>resolves{' '}
            <span className="text-accent">@&lt;this-project&gt;.dev.&lt;alias&gt;</span> into the
            subprocess
          </pre>
        </div>

        <div className="mt-7">
          <Button onClick={onCreate} className="gap-1.5">
            <Plus size={14} strokeWidth={2.25} />
            Add first secret
          </Button>
        </div>
      </div>
    </div>
  );
}
