'use client';

import { SectionHeader, StatCard } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { LoadMoreButton } from '@/components/ui/load-more-button';
import { formatRelative } from '@/lib/time';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { type ProjectSummary, loadMoreProjectsAction } from '../_actions/actions';

export type { ProjectSummary };

export function ProjectsListing({
  initialProjects,
  initialCursor,
}: {
  initialProjects: ProjectSummary[];
  initialCursor: string | null;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (cursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await loadMoreProjectsAction(cursor);
      setProjects((prev) => [...prev, ...result.projects]);
      setCursor(result.next_cursor);
    } catch {
      // silent fail
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const totalSecrets = projects.reduce((sum, p) => sum + p.secret_count, 0);
  const totalEnvs = projects.reduce((sum, p) => sum + p.env_count, 0);
  const hasMore = cursor != null;

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Projects"
          value={`${projects.length.toLocaleString()}${hasMore ? '+' : ''}`}
          hint={hasMore ? 'load more for full count' : 'namespaces'}
        />
        <StatCard
          label="Environments"
          value={totalEnvs.toLocaleString()}
          hint="across loaded projects"
        />
        <StatCard
          label="Secrets"
          value={totalSecrets.toLocaleString()}
          hint="across loaded projects"
        />
      </section>

      <section>
        <SectionHeader
          title="all projects"
          count={projects.length}
          actions={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
              sorted by recency
            </span>
          }
        />

        <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {projects.map((p) => (
            <li key={p.id} className="animate-list-enter">
              <Link
                href={{ pathname: `/projects/${p.id}` }}
                className="group block px-4 py-4 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-fg truncate tracking-tight">
                        {p.name}
                      </span>
                      <span className="font-mono text-[11px] text-fg-subtle tabular">{p.id}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-fg-muted">
                      <span className="font-mono tabular">
                        {p.secret_count} {p.secret_count === 1 ? 'secret' : 'secrets'}
                      </span>
                      <span className="text-fg-subtle">·</span>
                      <span>created {formatRelative(p.created_at)}</span>
                    </div>
                  </div>

                  {p.env_names ? (
                    <div className="hidden sm:flex items-center gap-1.5">
                      {p.env_names.split(',').map((name) => (
                        <Badge key={name} tone="neutral">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <ArrowUpRight
                    size={15}
                    className="shrink-0 text-fg-subtle group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-fast ease-snap"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {cursor !== null ? <LoadMoreButton loading={loadingMore} onClick={loadMore} /> : null}
    </>
  );
}
