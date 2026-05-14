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
        <div key={section.section} className="mb-6">
          <div className="px-2 mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            {section.section}
          </div>
          <ul className="flex flex-col gap-px">
            {section.pages.map((page) => {
              const href = `/docs/${page.slug}`;
              const active = pathname === href;
              return (
                <li key={page.slug}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-fast ease-snap',
                      active
                        ? 'bg-bg-elevated-hover text-fg'
                        : 'text-fg-muted hover:bg-bg-elevated-hover hover:text-fg',
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute -left-2.5 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-accent"
                      />
                    ) : null}
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
