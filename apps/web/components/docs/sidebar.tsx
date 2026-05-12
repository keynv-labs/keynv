'use client';

import { cn } from '@/lib/cn';
import { DOC_REGISTRY } from '@/lib/docs-registry';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DocsSidebar() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Docs navigation">
      {DOC_REGISTRY.map((section, idx) => (
        <div key={section.section} className="mb-6">
          <div className="px-1 mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
            § {String(idx + 1).padStart(2, '0')} · {section.section}
          </div>
          <ul className="flex flex-col">
            {section.pages.map((page) => {
              const href = `/docs/${page.slug}`;
              const active = pathname === href;
              return (
                <li key={page.slug}>
                  <Link
                    href={{ pathname: href } as never}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block py-1.5 px-2 font-sans text-[14px] leading-snug transition-colors duration-fast ease-snap border-l-2',
                      active
                        ? 'border-fg text-fg font-medium'
                        : 'border-transparent text-fg-muted hover:text-fg hover:border-fg-subtle',
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
