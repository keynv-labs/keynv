import { DocsSidebar } from '@/components/docs/sidebar';
import { SkipLink } from '@/components/ui/skip-link';
import { Github } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 md:px-6 h-14 flex items-center gap-4">
          <Link
            href={{ pathname: '/' }}
            className="flex items-center gap-2 font-semibold tracking-tight text-fg"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-fg-on-accent text-[11px] font-bold">
              k
            </span>
            <span>keynv</span>
          </Link>
          <span className="text-sm text-fg-muted">/ Docs</span>
          <div className="ml-auto flex items-center gap-4 text-sm text-fg-muted">
            <Link
              href={{ pathname: '/changelog' }}
              className="hover:text-fg transition-colors duration-fast ease-snap"
            >
              Changelog
            </Link>
            <a
              href="https://github.com/keynv-labs/keynv"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-fg transition-colors duration-fast ease-snap"
            >
              <Github size={13} strokeWidth={2} />
              GitHub
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl w-full flex-1 flex gap-8 px-4 md:px-6 py-8">
        <aside className="hidden md:block w-60 shrink-0 sticky top-20 self-start">
          <DocsSidebar />
        </aside>
        <main id="main" className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
