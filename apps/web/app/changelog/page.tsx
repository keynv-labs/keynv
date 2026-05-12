import { Button } from '@/components/ui/button';
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
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 md:px-6 h-14 flex items-center gap-4">
          <Link
            href={{ pathname: '/' }}
            className="flex items-center gap-2 font-semibold tracking-tight text-fg"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-fg-on-accent text-[11px] font-bold">
              k
            </span>
            <span>keynv</span>
          </Link>
          <span className="text-sm text-fg-muted">/ Changelog</span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={{ pathname: '/changelog/rss.xml' }}
              className="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 text-sm"
            >
              <Rss size={13} strokeWidth={2} />
              RSS
            </Link>
            <a
              href="https://github.com/keynv-labs/keynv/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noreferrer"
              className="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 text-sm"
            >
              <Github size={13} strokeWidth={2} />
              Source
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-12 md:py-16">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
            {TITLE}
          </h1>
          <p className="mt-3 text-base text-fg-muted leading-relaxed max-w-2xl">{DESCRIPTION}</p>

          {intro ? (
            <div className="mt-6 rounded-lg border border-border bg-bg-elevated px-5 py-4">
              <Prose markdown={intro} />
            </div>
          ) : null}

          <ol className="mt-12 space-y-10">
            {sections.map((s) => (
              <Section key={s.anchor} section={s} />
            ))}
          </ol>

          <div className="mt-16 border-t border-border pt-8 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-fg-muted">
              Want the firehose? <span className="text-fg">Watch the repo on GitHub.</span>
            </p>
            <Link href={{ pathname: '/' }}>
              <Button variant="secondary" className="gap-1.5">
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
    <li id={section.anchor} className="scroll-mt-20">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-xl font-semibold tracking-tight text-fg">
          <Link
            href={{ pathname: '/changelog', hash: section.anchor } as never}
            className="hover:underline"
          >
            {section.version}
          </Link>
        </h2>
        {section.date ? (
          <time className="text-sm font-mono text-fg-subtle">{section.date}</time>
        ) : null}
        {isUnreleased ? (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-warn">
            in progress
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <Prose markdown={section.bodyMarkdown} />
      </div>
    </li>
  );
}

function Prose({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 text-sm text-fg-muted leading-relaxed [&_h3]:text-fg [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-1 [&_h4]:text-fg [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_li]:leading-relaxed [&_a]:text-fg [&_a]:underline [&_a]:decoration-fg-subtle hover:[&_a]:decoration-fg [&_code]:font-mono [&_code]:text-fg [&_code]:bg-bg-elevated [&_code]:border [&_code]:border-border [&_code]:rounded [&_code]:px-1 [&_code]:py-px [&_code]:text-[0.9em] [&_strong]:text-fg [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-fg-subtle">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
