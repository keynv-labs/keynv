'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { Download, Search } from 'lucide-react';
import { useTransition } from 'react';
import { exportAuditAction } from '@/app/(authed)/audit/_actions/export-action';
import { CATEGORY_LABELS, type Category, categoryOf } from './event';
import type { AuditEntry } from './types';

export const FILTER_ORDER: Category[] = [
  'project',
  'secret',
  'member',
  'approval',
  'auth',
  'user',
  'other',
];

function ExportDropdown() {
  const [pending, start] = useTransition();

  function download(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExport(format: 'csv' | 'json') {
    start(async () => {
      const content = await exportAuditAction(format);
      download(content, `audit-export.${format}`, format === 'csv' ? 'text/csv' : 'application/json');
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => handleExport('csv')}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg-muted hover:text-fg hover:border-border-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={10} strokeWidth={2} />
        {pending ? '…' : 'CSV'}
      </button>
      <span className="text-fg-subtle">/</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => handleExport('json')}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
      >
        JSON
      </button>
    </div>
  );
}

export function FilterBar({
  entries,
  filteredCount,
  activeCategories,
  search,
  onToggleCategory,
  onSearchChange,
  onClear,
}: {
  entries: AuditEntry[];
  filteredCount: number;
  activeCategories: Set<Category>;
  search: string;
  onToggleCategory: (c: Category) => void;
  onSearchChange: (s: string) => void;
  onClear: () => void;
}) {
  const availableCategories = FILTER_ORDER.filter((c) => {
    for (const e of entries) {
      if (categoryOf(e.event_type) === c) return true;
    }
    return false;
  });

  const isFiltering = activeCategories.size > 0 || search.length > 0;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1 flex-wrap">
        {availableCategories.map((c) => {
          const active = activeCategories.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => onToggleCategory(c)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em]',
                'transition-colors duration-fast ease-snap',
                active
                  ? 'border-accent-soft-border bg-accent-soft text-accent'
                  : 'border-border bg-bg-elevated text-fg-muted hover:text-fg hover:border-border-strong',
              )}
            >
              {CATEGORY_LABELS[c]}
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
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search payload, actor, alias…"
          className="pl-8"
        />
      </div>

      {isFiltering ? (
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
        >
          clear
        </button>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        <ExportDropdown />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
          <span className="text-fg tabular">{filteredCount}</span> of{' '}
          <span className="tabular">{entries.length}</span>
        </span>
      </div>
    </div>
  );
}
