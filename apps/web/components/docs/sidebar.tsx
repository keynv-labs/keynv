'use client';

import { cn } from '@/lib/cn';
import { DOC_REGISTRY } from '@/lib/docs-registry';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DocsSidebar() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Docs navigation" className="text-sm">
      {DOC_REGISTRY.map((section) => (
        <div key={section.section} className="mb-5">
          <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            {section.section}
          </div>
          <ul className="flex flex-col gap-0.5">
            {section.pages.map((page) => {
              const href = `/docs/${page.slug}`;
              const active = pathname === href;
              return (
                <li key={page.slug}>
                  <Link
                    href={{ pathname: href } as never}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-fast ease-snap',
                      active
                        ? 'bg-bg-elevated-hover text-fg'
                        : 'text-fg-muted hover:bg-bg-elevated-hover hover:text-fg',
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
