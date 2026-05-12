import { Stamp } from '@/components/dossier/stamp';
import { SkipLink } from '@/components/ui/skip-link';
import { type ChangelogSection, parseChangelog, readRepoFile } from '@/lib/markdown';
import { ArrowLeft, Github, Rss } from 'lucide-react';
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
    <div className="newsprint min-h-screen flex flex-col">
      <SkipLink />
      <header className="border-b-2 border-fg/90">
        <div className="border-b border-border">
          <div className="mx-auto max-w-3xl px-4 md:px-6 py-2 flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.22em] text-fg-muted">
            <span>VOL. I · CHANGELOG</span>
            <span className="hidden sm:inline">PRESS LOG</span>
            <span>keynv.dev</span>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href={{ pathname: '/' }}
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted hover:text-fg"
          >
            <ArrowLeft size={13} strokeWidth={2} />
            Home
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-fg-muted">
            <Link
              href={{ pathname: '/changelog/rss.xml' }}
              className="hover:text-fg inline-flex items-center gap-1.5"
            >
              <Rss size={13} strokeWidth={2} />
              RSS
            </Link>
            <a
              href="https://github.com/keynv-labs/keynv/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noreferrer"
              className="hover:text-fg inline-flex items-center gap-1.5"
            >
              <Github size={13} strokeWidth={2} />
              Source
            </a>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-12 md:py-16">
          <Stamp parts={['CHANGELOG', 'RELEASE LOG']} />
          <h1 className="font-display text-[clamp(2.75rem,6vw,4.5rem)] font-medium tracking-[-0.02em] leading-[0.98] mt-5">
            {TITLE}
          </h1>
          <p className="font-sans text-[18px] leading-[1.6] text-fg-muted mt-5 max-w-[60ch]">
            {DESCRIPTION}
          </p>

          {intro ? (
            <div className="mt-8 border-l-4 border-fg pl-5 py-1">
              <ProseSmall markdown={intro} />
            </div>
          ) : null}

          <ol className="mt-16 space-y-16">
            {sections.map((s) => (
              <Section key={s.anchor} section={s} />
            ))}
          </ol>

          <div className="mt-20 border-t-2 border-fg pt-6 flex items-center justify-between gap-4 flex-wrap font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
            <span>END OF LOG · {new Date().toISOString().slice(0, 10)}</span>
            <span>Want the firehose? Watch on GitHub.</span>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ section }: { section: ChangelogSection }) {
  const isUnreleased = section.version.toLowerCase() === 'unreleased';
  return (
    <li id={section.anchor} className="scroll-mt-24">
      <header className="border-t-2 border-fg pt-5">
        <Stamp
          parts={[
            isUnreleased ? 'STATUS — IN PROGRESS' : 'STATUS — RELEASED',
            section.date ? `DATE — ${section.date}` : null,
          ]}
        />
        <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em] leading-[1.0] mt-3">
          <Link
            href={{ pathname: '/changelog', hash: section.anchor } as never}
            className="hover:underline underline-offset-4 decoration-fg/40"
          >
            {section.version}
          </Link>
        </h2>
      </header>
      <div className="mt-5">
        <Prose markdown={section.bodyMarkdown} />
      </div>
    </li>
  );
}

function Prose({ markdown }: { markdown: string }) {
  return (
    <div
      className={[
        'font-sans text-[17px] leading-[1.7] text-fg-muted',
        '[&_h3]:font-display [&_h3]:text-fg [&_h3]:text-[22px] [&_h3]:font-medium [&_h3]:tracking-[-0.01em] [&_h3]:leading-tight [&_h3]:mt-8 [&_h3]:mb-2',
        '[&_h4]:font-mono [&_h4]:text-fg [&_h4]:text-[11px] [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-[0.22em] [&_h4]:mt-6 [&_h4]:mb-2',
        '[&_p]:my-3',
        '[&_ul]:list-none [&_ul]:pl-0 [&_ul]:my-3 [&_ul]:space-y-2 [&_ul>li]:relative [&_ul>li]:pl-5 [&_ul>li]:before:content-["§"] [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:text-fg-subtle [&_ul>li]:before:font-mono [&_ul>li]:before:text-sm',
        '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_ol]:space-y-2 [&_ol]:marker:text-fg-subtle [&_ol]:marker:font-mono',
        '[&_li]:leading-[1.65]',
        '[&_a]:text-fg [&_a]:underline [&_a]:decoration-fg-subtle [&_a]:underline-offset-[3px] hover:[&_a]:decoration-fg',
        '[&_code]:font-mono [&_code]:text-fg [&_code]:bg-bg-elevated [&_code]:border [&_code]:border-border [&_code]:rounded-sm [&_code]:px-1 [&_code]:py-px [&_code]:text-[0.88em]',
        '[&_pre]:my-5 [&_pre]:border [&_pre]:border-fg/40 [&_pre]:bg-bg-overlay [&_pre]:p-4 [&_pre]:overflow-x-auto',
        '[&_strong]:text-fg [&_strong]:font-semibold',
        '[&_em]:italic [&_em]:font-display',
        '[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-fg [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-fg [&_blockquote]:font-display',
      ].join(' ')}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

function ProseSmall({ markdown }: { markdown: string }) {
  return (
    <div className="font-sans italic text-[15px] leading-[1.55] text-fg-muted [&_p]:my-1 [&_a]:underline">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
