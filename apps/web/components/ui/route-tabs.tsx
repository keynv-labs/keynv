'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface RouteTab {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}

export function RouteTabs({ tabs }: { tabs: RouteTab[] }) {
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="Section navigation"
      className="flex border-b border-border -mx-4 px-4 md:-mx-6 md:px-6 overflow-x-auto"
    >
      <ul className="flex items-center gap-0">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={{ pathname: tab.href }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center px-3 py-2.5 text-sm whitespace-nowrap',
                  'border-b-2 -mb-px',
                  'transition-colors duration-fast ease-snap',
                  active
                    ? 'border-fg text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg',
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
