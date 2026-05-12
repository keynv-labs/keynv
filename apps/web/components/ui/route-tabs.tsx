'use client';

import { cn } from '@/lib/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface RouteTab {
  href: string;
  label: string;
  /**
   * When true, the tab is also active for any pathname nested below
   * `href` (e.g. `/projects/abc/secrets/some-future-detail`). Default
   * is exact match only — the parent / index tab uses the bare `href`.
   */
  nested?: boolean;
}

export function RouteTabs({ tabs }: { tabs: RouteTab[] }) {
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="Section navigation"
      className="flex border-b border-border -mx-4 px-4 md:-mx-6 md:px-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max items-center gap-0">
        {tabs.map((tab) => {
          const active = tab.nested
            ? pathname === tab.href || pathname.startsWith(`${tab.href}/`)
            : pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={{ pathname: tab.href }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center px-3 py-2.5 text-sm whitespace-nowrap',
                  'border-b-2 -mb-px font-medium',
                  'transition-colors duration-fast ease-snap',
                  active
                    ? 'border-accent text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg hover:border-border-strong',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
