'use client';

import { Input } from '@/components/ui/input';
import { LoadMoreButton } from '@/components/ui/load-more-button';
import Link from 'next/link';
import { useState } from 'react';
import { type SearchResult, searchSecrets } from './search-action';

export function SearchClient() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    setActiveQuery(trimmed);
    try {
      const data = await searchSecrets(trimmed);
      setResults(data.results);
      setCursor(data.next_cursor);
    } catch {
      setResults([]);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    if (!activeQuery || cursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await searchSecrets(activeQuery, cursor);
      setResults((prev) => [...prev, ...data.results]);
      setCursor(data.next_cursor);
    } catch {
      // silent fail — user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Search Secrets</h1>
      <form onSubmit={handleSearch} className="mb-8">
        <Input
          type="search"
          placeholder="Search by key, environment, or project name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 text-base"
        />
      </form>

      {loading && <p className="text-fg-subtle text-sm">Searching…</p>}

      {!loading && searched && results.length === 0 && (
        <p className="text-fg-subtle text-sm">No results found.</p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((r) => (
            <li key={r.secret_id}>
              <Link
                href={`/projects/${r.project_id}/secrets`}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-sm truncate">
                    @{r.project_name}.{r.env_name}.{r.key}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-fg-subtle">v{r.version}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${r.env_tier === 'production' ? 'bg-warn-bg text-warn-fg' : 'bg-success-bg text-success-fg'}`}
                  >
                    {r.env_tier === 'production' ? 'prod' : r.env_tier}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cursor !== null ? (
        <div className="mt-4">
          <LoadMoreButton loading={loadingMore} onClick={handleLoadMore} />
        </div>
      ) : null}
    </div>
  );
}
