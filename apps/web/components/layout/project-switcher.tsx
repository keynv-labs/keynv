'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

interface ProjectListItem {
  id: string;
  name: string;
}

interface Props {
  current: ProjectListItem;
  projects: ProjectListItem[];
}

/**
 * Display-headline project switcher. The current project's name is the
 * page H1; clicking it opens a dropdown to jump to any other project
 * without bouncing through /projects.
 */
export function ProjectSwitcher({ current, projects }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState('');

  const sorted = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [sorted, filter]);

  return (
    <DropdownMenu onOpenChange={(open) => !open && setFilter('')}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Switch project (current: ${current.name})`}
          className="group inline-flex items-center gap-2 text-left max-w-full hover:bg-bg-elevated-hover -mx-2 px-2 py-1 rounded-md transition-colors duration-fast ease-snap"
        >
          <h1 className="display text-[26px] md:text-[30px] tracking-tight text-fg truncate">
            {current.name}
          </h1>
          <ChevronsUpDown
            size={16}
            strokeWidth={2}
            className="shrink-0 text-fg-subtle group-hover:text-accent transition-colors duration-fast ease-snap"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-h-[60vh] overflow-y-auto">
        {projects.length > 6 ? (
          <div className="px-2 pt-1 pb-2 border-b border-border">
            <Input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter projects…"
              // biome-ignore lint/a11y/noAutofocus: this filter only mounts when the dropdown opens via an explicit user click, so focus-stealing concerns don't apply.
              autoFocus
              className="h-7 px-2"
            />
          </div>
        ) : null}
        <DropdownMenuLabel>projects</DropdownMenuLabel>
        {filtered.length === 0 ? (
          <div className="px-2 py-3 text-xs text-fg-subtle text-center">No matches.</div>
        ) : (
          filtered.map((p) => {
            const isCurrent = p.id === current.id;
            return (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => {
                  if (isCurrent) return;
                  router.push(`/projects/${p.id}/secrets`);
                }}
                className="flex items-center gap-2"
              >
                <span className="flex-1 truncate">{p.name}</span>
                {isCurrent ? (
                  <Check size={13} strokeWidth={2.5} className="shrink-0 text-accent" />
                ) : (
                  <span className="font-mono text-[10px] text-fg-subtle tabular truncate max-w-[14ch]">
                    {p.id}
                  </span>
                )}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={{ pathname: '/projects/new' }} className="flex items-center gap-2">
            <Plus size={13} strokeWidth={2.25} className="text-accent" />
            New project
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
