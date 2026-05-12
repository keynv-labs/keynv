import { DocsSidebar } from '@/components/docs/sidebar';
import { SkipLink } from '@/components/ui/skip-link';
import { Github } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="newsprint min-h-screen flex flex-col">
      <SkipLink />
      <header className="border-b-2 border-fg/90">
        <div className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 md:px-6 py-2 flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.22em] text-fg-muted">
            <span>VOL. I · DOCUMENTATION</span>
            <span className="hidden sm:inline">PUBLIC RECORD</span>
            <span>keynv.dev</span>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <Link href={{ pathname: '/' }} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center bg-fg text-bg font-display font-medium text-xl leading-none shrink-0"
              style={{ boxShadow: '3px 3px 0 0 var(--color-highlight)' }}
            >
              k
            </span>
            <span className="font-display text-3xl font-medium tracking-tight">keynv</span>
            <span className="text-fg-subtle mx-2" aria-hidden>
              /
            </span>
            <span className="font-display text-3xl font-medium tracking-tight italic text-fg-muted">
              Documentation
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-[13px] text-fg-muted">
            <Link
              href={{ pathname: '/' }}
              className="hover:text-fg transition-colors duration-fast ease-snap"
            >
              Home
            </Link>
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
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl w-full flex-1 flex gap-10 px-4 md:px-6 py-10">
        <aside className="hidden md:block w-56 shrink-0 sticky top-20 self-start">
          <DocsSidebar />
        </aside>
        <main id="main" className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
