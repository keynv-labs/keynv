'use client';

import { Badge, envTone } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/time';
import { ChevronRight } from 'lucide-react';
import { SecretHistoryPanel } from './history-panel';
import { RowActions } from './row-actions';

export interface Environment {
  name: string;
  tier: string;
}

export interface SecretRow {
  alias: string;
  version: number;
  created_at: string;
}

export interface ParsedSecret extends SecretRow {
  env: string;
  keyName: string;
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

export function SecretsTable({
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
