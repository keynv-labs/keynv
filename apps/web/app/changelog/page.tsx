import { Logomark } from '@/components/brand/logomark';
import { Button } from '@/components/ui/button';
import { SkipLink } from '@/components/ui/skip-link';
import { type ChangelogSection, parseChangelog, readRepoFile } from '@/lib/markdown';
import { ArrowRight, Github, Rss } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-static';

const TITLE = 'Changelog';
const DESCRIPTION =
  'What shipped, when, and why. Every release of keynv — the AI-safe secrets vault — is logged here.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: `${TITLE} · keynv`,
    description: DESCRIPTION,
    type: 'article',
  },
  alternates: {
    canonical: 'https://keynv.dev/changelog',
    types: { 'application/rss+xml': 'https://keynv.dev/changelog/rss.xml' },
  },
};

export default async function ChangelogPage() {
  const raw = await readRepoFile('CHANGELOG.md');
  const { intro, sections } = parseChangelog(raw);

  return (
    <div className="min-h-screen flex flex-col">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 md:px-6 h-14 flex items-center gap-4">
          <Link href={{ pathname: '/' }} className="flex items-center">
            <Logomark size={22} />
          </Link>
          <span
            aria-hidden
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-subtle"
          >
            / changelog
          </span>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href={{ pathname: '/changelog/rss.xml' }}
              className="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 text-sm transition-colors duration-fast ease-snap"
            >
              <Rss size={13} strokeWidth={2} />
              RSS
            </Link>
            <a
              href="https://github.com/keynv-labs/keynv/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noreferrer"
              className="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 text-sm transition-colors duration-fast ease-snap"
            >
              <Github size={13} strokeWidth={2} />
              Source
            </a>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-14 md:py-20">
          <div className="display-eyebrow mb-3">release log · what shipped, when, why</div>
          <h1 className="display text-3xl md:text-[42px] tracking-tight leading-[1.05]">{TITLE}</h1>
          <p className="mt-5 text-base text-fg-muted leading-relaxed max-w-2xl">{DESCRIPTION}</p>

          {intro ? (
            <div className="mt-8 rounded-lg border border-border bg-bg-elevated px-5 py-4">
              <Prose markdown={intro} />
            </div>
          ) : null}

          <ol className="mt-14 space-y-12 relative">
            <div
              aria-hidden
              className="absolute left-2 top-2 bottom-2 w-px bg-border hidden md:block"
            />
            {sections.map((s) => (
              <Section key={s.anchor} section={s} />
            ))}
          </ol>

          <div className="mt-16 border-t border-border pt-8 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-fg-muted">
              Want the firehose? <span className="text-accent">Watch the repo on GitHub.</span>
            </p>
            <Link href={{ pathname: '/' }}>
              <Button variant="outline" className="gap-1.5">
                Back home
                <ArrowRight size={13} strokeWidth={2.25} />
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ section }: { section: ChangelogSection }) {
  const isUnreleased = section.version.toLowerCase() === 'unreleased';
  return (
    <li id={section.anchor} className="scroll-mt-20 relative md:pl-8">
      <span
        aria-hidden
        className="hidden md:block absolute left-0 top-2 h-2 w-2 rounded-full bg-accent ring-4 ring-bg"
      />
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="display text-2xl tracking-tight text-fg">
          <Link
            href={`/changelog#${section.anchor}`}
            className="hover:underline decoration-accent decoration-2 underline-offset-4"
          >
            {section.version}
          </Link>
        </h2>
        {section.date ? (
          <time className="font-mono text-xs tabular text-fg-subtle">{section.date}</time>
        ) : null}
        {isUnreleased ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] font-medium text-warn rounded-sm border border-warn-soft-border bg-warn-soft px-1.5 py-0.5">
            in progress
          </span>
        ) : null}
      </div>
      <div className="mt-4">
        <Prose markdown={section.bodyMarkdown} />
      </div>
    </li>
  );
}

function Prose({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 text-[15px] text-fg-muted leading-[1.7] [&_h3]:text-fg [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-1 [&_h4]:text-fg [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-5 [&_h4]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_li]:leading-[1.7] [&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/40 hover:[&_a]:decoration-accent [&_code]:font-mono [&_code]:text-accent [&_code]:bg-bg-inset [&_code]:border [&_code]:border-border [&_code]:rounded [&_code]:px-1.5 [&_code]:py-px [&_code]:text-[0.88em] [&_strong]:text-fg [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:text-fg">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
