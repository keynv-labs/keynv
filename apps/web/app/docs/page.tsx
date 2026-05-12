import { Stamp } from '@/components/dossier/stamp';
import { Button } from '@/components/ui/button';
import { DOC_REGISTRY } from '@/lib/docs-registry';
import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Architecture, threat model, API spec, and operator guides for keynv — the AI-safe secrets vault.',
  alternates: { canonical: 'https://keynv.dev/docs' },
};

export default function DocsIndex() {
  return (
    <div className="max-w-4xl">
      <Stamp parts={['VOL. I', 'DOCUMENTATION', 'PUBLIC RECORD']} />
      <h1 className="font-display text-[clamp(2.75rem,6vw,4.5rem)] font-medium tracking-[-0.02em] leading-[0.98] mt-5">
        Documentation
      </h1>
      <p className="font-sans text-[19px] leading-[1.6] text-fg-muted mt-5 max-w-[58ch]">
        Everything you need to self-host keynv, integrate it with your AI coding agent, and reason
        about what it does — and doesn&rsquo;t — defend against.
      </p>

      <div className="mt-14 space-y-14">
        {DOC_REGISTRY.map((section, idx) => (
          <Section
            key={section.section}
            idx={idx + 1}
            title={section.section}
            pages={section.pages}
          />
        ))}
      </div>

      <div className="mt-16 border-t-2 border-fg pt-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
            SOURCE
          </div>
          <p className="mt-1 font-display text-xl font-medium tracking-tight">
            Want everything in one place?
          </p>
        </div>
        <a
          href="https://github.com/keynv-labs/keynv/tree/main/docs"
          target="_blank"
          rel="noreferrer"
        >
          <Button
            variant="secondary"
            className="gap-1.5 rounded-none border border-fg bg-transparent text-fg hover:bg-fg/10"
          >
            View on GitHub
            <ArrowRight size={13} strokeWidth={2.25} />
          </Button>
        </a>
      </div>
    </div>
  );
}

interface SectionProps {
  idx: number;
  title: string;
  pages: ReadonlyArray<{ slug: string; title: string; summary?: string }>;
}

function Section({ idx, title, pages }: SectionProps) {
  return (
    <section>
      <header className="flex items-baseline justify-between gap-4 border-b-2 border-fg pb-3">
        <h2 className="font-display text-[28px] font-medium tracking-[-0.01em] leading-tight">
          § {String(idx).padStart(2, '0')} · {title}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
          {pages.length} {pages.length === 1 ? 'entry' : 'entries'}
        </span>
      </header>
      <ul className="divide-y divide-fg/20">
        {pages.map((page) => (
          <li key={page.slug}>
            <Link
              href={{ pathname: `/docs/${page.slug}` } as never}
              className="group flex items-start gap-6 py-5 hover:bg-bg-elevated transition-colors duration-fast ease-snap -mx-3 px-3"
            >
              <div className="flex-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="font-display text-[22px] font-medium tracking-[-0.01em] leading-tight text-fg group-hover:underline underline-offset-4 decoration-fg/40">
                    {page.title}
                  </h3>
                </div>
                {page.summary ? (
                  <p className="mt-1.5 font-sans text-[16px] leading-[1.55] text-fg-muted">
                    {page.summary}
                  </p>
                ) : null}
              </div>
              <ArrowRight
                size={16}
                strokeWidth={2}
                className="mt-2 shrink-0 text-fg-subtle group-hover:text-fg transition-colors duration-fast ease-snap"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
