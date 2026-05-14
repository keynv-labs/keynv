import { SectionHeader } from '@/components/layout/page-header';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export interface SidebarProjectPendingItem {
  project_id: string;
  project_name: string;
  id: string;
}

interface SidebarItem {
  project: { id: string; name: string };
  envCount: number;
  secretCount: number;
  pending: SidebarProjectPendingItem[];
}

export function ProjectsSidebar({
  items,
  totalCount,
}: {
  items: SidebarItem[];
  totalCount: number;
}) {
  return (
    <div>
      <SectionHeader
        title="projects"
        count={totalCount}
        actions={
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
          >
            all
            <ArrowUpRight size={11} strokeWidth={2} />
          </Link>
        }
      />
      <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
        {items.map((x) => (
          <li key={x.project.id} className="animate-list-enter">
            <Link
              href={`/projects/${x.project.id}/secrets`}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-fg truncate tracking-tight">
                  {x.project.name}
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular text-fg-subtle">
                  {x.secretCount} keys · {x.envCount} env
                  {x.pending.length > 0 ? (
                    <span className="ml-2 text-warn">· {x.pending.length} pending</span>
                  ) : null}
                </div>
              </div>
              <ArrowUpRight
                size={13}
                strokeWidth={2}
                className="shrink-0 text-fg-subtle group-hover:text-accent transition-colors"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
