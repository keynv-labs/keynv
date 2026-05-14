'use client';

import { cn } from '@/lib/cn';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Category,
  categoryOf,
  dayBucket,
} from './event';
import { FilterBar, FILTER_ORDER } from './filter-bar';
import { TimelineRow } from './timeline-row';
import type { AuditEntry } from './types';

export type { AuditEntry };

interface Props {
  entries: AuditEntry[];
  nextCursor: number | null;
}

const ALL_CATEGORIES = new Set<Category>(FILTER_ORDER);

function parseInitialCategories(raw: string | null): Set<Category> {
  if (!raw) return new Set();
  const next = new Set<Category>();
  for (const piece of raw.split(',')) {
    const trimmed = piece.trim();
    if (trimmed && ALL_CATEGORIES.has(trimmed as Category)) {
      next.add(trimmed as Category);
    }
  }
  return next;
}

export function AuditTimeline({ entries: initialEntries, nextCursor: initialCursor }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [allEntries, setAllEntries] = useState<AuditEntry[]>(initialEntries);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(() =>
    parseInitialCategories(searchParams?.get('cat') ?? null),
  );
  const [search, setSearch] = useState(() => searchParams?.get('q') ?? '');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Push filter state back into the URL (replace, not push, so the back
  // button doesn't trap users in every keystroke). Skip the first render
  // — initial state already came from the URL.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (activeCategories.size > 0) {
      params.set('cat', Array.from(activeCategories).join(','));
    } else {
      params.delete('cat');
    }
    if (search.trim()) {
      params.set('q', search.trim());
    } else {
      params.delete('q');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [activeCategories, search, pathname, router, searchParams]);

  const filtered = useMemo(() => {
    return allEntries.filter((e) => {
      if (activeCategories.size > 0 && !activeCategories.has(categoryOf(e.event_type))) {
        return false;
      }
      if (search) {
        const haystack = `${e.event_type} ${JSON.stringify(e.payload ?? {})} ${
          e.actor_user_id ?? ''
        } ${e.actor_agent}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [allEntries, activeCategories, search]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, { label: string; entries: AuditEntry[] }>();
    for (const e of filtered) {
      const { key, label } = dayBucket(e.ts);
      const bucket = buckets.get(key);
      if (bucket) bucket.entries.push(e);
      else buckets.set(key, { label, entries: [e] });
    }
    return Array.from(buckets.entries());
  }, [filtered]);

  const loadMore = useCallback(async () => {
    if (cursor === null || loading) return;
    setLoading(true);
    try {
      const { loadMoreAuditAction } = await import('@/app/(authed)/actions');
      const result = await loadMoreAuditAction(cursor);
      setAllEntries((prev) => [...prev, ...result.entries]);
      setCursor(result.next_cursor);
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  function toggleCategory(c: Category) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <FilterBar
        entries={allEntries}
        filteredCount={filtered.length}
        activeCategories={activeCategories}
        search={search}
        onToggleCategory={toggleCategory}
        onSearchChange={setSearch}
        onClear={() => {
          setActiveCategories(new Set());
          setSearch('');
        }}
      />

      {allEntries.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center text-sm text-fg-muted">
          No audit entries yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center text-sm text-fg-muted">
          No audit entries match those filters.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([key, { label, entries: dayEntries }]) => (
            <section key={key}>
              <h2 className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm py-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
                {label}
              </h2>
              <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
                {dayEntries.map((entry) => (
                  <li key={entry.id} className="animate-list-enter">
                    <TimelineRow
                      entry={entry}
                      expanded={expanded.has(entry.id)}
                      onToggle={() => toggleExpand(entry.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {cursor !== null ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em]',
              'transition-colors duration-fast ease-snap',
              loading
                ? 'text-fg-subtle cursor-not-allowed'
                : 'text-fg-muted hover:text-fg hover:border-border-strong',
            )}
          >
            {loading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                loading
              </>
            ) : (
              'load more'
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}




