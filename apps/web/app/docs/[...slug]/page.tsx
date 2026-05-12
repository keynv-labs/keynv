import { Stamp } from '@/components/dossier/stamp';
import { Button } from '@/components/ui/button';
import { allDocSlugs, loadDoc } from '@/lib/docs';
import { ArrowLeft, ArrowRight, Github } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return allDocSlugs().map((slug) => ({ slug: slug.split('/') }));
}

interface Params {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = await loadDoc(slug.join('/'));
  if (!doc) return { title: 'Not found · keynv' };
  return {
    title: doc.page.title,
    description: doc.page.summary ?? `${doc.page.title} — keynv documentation.`,
    alternates: { canonical: `https://keynv.dev/docs/${doc.page.slug}` },
    openGraph: {
      type: 'article',
      title: `${doc.page.title} · keynv`,
      description: doc.page.summary ?? '',
    },
  };
}

export default async function DocPage({ params }: Params) {
  const { slug } = await params;
  const doc = await loadDoc(slug.join('/'));
  if (!doc) notFound();

  const githubUrl = `https://github.com/keynv-labs/keynv/blob/main/${doc.page.file}`;

  return (
    <article className="max-w-3xl">
      <Stamp parts={[doc.section.toUpperCase(), `FILE — ${doc.page.file}`]} />

      <nav className="mt-4 text-[12px] font-mono uppercase tracking-[0.18em] text-fg-subtle flex items-center gap-2">
        <Link href={{ pathname: '/docs' }} className="hover:text-fg">
          DOCS
        </Link>
        <span aria-hidden>›</span>
        <span className="text-fg-muted">{doc.section}</span>
      </nav>

      <Prose markdown={doc.raw} />

      <div className="mt-12 border-t-2 border-fg pt-6 grid gap-4 sm:grid-cols-2">
        {doc.prev ? (
          <Link
            href={{ pathname: `/docs/${doc.prev.slug}` } as never}
            className="group flex items-start gap-3 hover:text-fg transition-colors duration-fast ease-snap"
          >
            <ArrowLeft
              size={16}
              strokeWidth={2}
              className="mt-1 shrink-0 text-fg-subtle group-hover:text-fg"
            />
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
                Previous
              </span>
              <span className="block font-display text-xl font-medium leading-tight mt-1">
                {doc.prev.title}
              </span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {doc.next ? (
          <Link
            href={{ pathname: `/docs/${doc.next.slug}` } as never}
            className="group flex items-start justify-end gap-3 text-right hover:text-fg transition-colors duration-fast ease-snap sm:ml-auto"
          >
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
                Next
              </span>
              <span className="block font-display text-xl font-medium leading-tight mt-1">
                {doc.next.title}
              </span>
            </span>
            <ArrowRight
              size={16}
              strokeWidth={2}
              className="mt-1 shrink-0 text-fg-subtle group-hover:text-fg"
            />
          </Link>
        ) : null}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
        <span>SOURCE — github.com/keynv-labs/keynv</span>
        <a href={githubUrl} target="_blank" rel="noreferrer">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-none border border-fg bg-transparent text-fg hover:bg-fg/10 gap-1.5"
          >
            <Github size={12} strokeWidth={2} />
            Edit on GitHub
          </Button>
        </a>
      </div>
    </article>
  );
}

function Prose({ markdown }: { markdown: string }) {
  return (
    <div
      className={[
        'prose-keynv font-sans text-[17px] leading-[1.7] text-fg-muted',
        '[&_h1]:font-display [&_h1]:text-fg [&_h1]:text-[clamp(2.25rem,5vw,3.25rem)] [&_h1]:font-medium [&_h1]:tracking-[-0.02em] [&_h1]:leading-[1.02] [&_h1]:mt-6 [&_h1]:mb-6',
        '[&_h2]:font-display [&_h2]:text-fg [&_h2]:text-[clamp(1.75rem,3.5vw,2.25rem)] [&_h2]:font-medium [&_h2]:tracking-[-0.015em] [&_h2]:leading-[1.1] [&_h2]:mt-14 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:border-t [&_h2]:border-fg/30 [&_h2]:pt-8',
        '[&_h3]:font-display [&_h3]:text-fg [&_h3]:text-[22px] [&_h3]:font-medium [&_h3]:tracking-[-0.01em] [&_h3]:leading-[1.2] [&_h3]:mt-10 [&_h3]:mb-2 [&_h3]:scroll-mt-24',
        '[&_h4]:font-mono [&_h4]:text-fg [&_h4]:text-[11px] [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-[0.22em] [&_h4]:mt-8 [&_h4]:mb-2',
        '[&_p]:my-4',
        '[&_ul]:list-none [&_ul]:pl-0 [&_ul]:my-4 [&_ul]:space-y-2 [&_ul>li]:relative [&_ul>li]:pl-5 [&_ul>li]:before:content-["§"] [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-0 [&_ul>li]:before:text-fg-subtle [&_ul>li]:before:font-mono [&_ul>li]:before:text-sm',
        '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_ol]:space-y-2 [&_ol]:marker:text-fg-subtle [&_ol]:marker:font-mono [&_ol]:marker:text-sm',
        '[&_li]:leading-[1.65]',
        '[&_a]:text-fg [&_a]:underline [&_a]:decoration-fg-subtle [&_a]:underline-offset-[3px] hover:[&_a]:decoration-fg',
        '[&_code]:font-mono [&_code]:text-fg [&_code]:bg-bg-elevated [&_code]:border [&_code]:border-border [&_code]:rounded-sm [&_code]:px-1 [&_code]:py-px [&_code]:text-[0.88em]',
        '[&_pre]:my-6 [&_pre]:border [&_pre]:border-fg/40 [&_pre]:bg-bg-overlay [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:shadow-[4px_4px_0_0_var(--color-redact)] [&_pre>code]:bg-transparent [&_pre>code]:border-0 [&_pre>code]:p-0',
        '[&_strong]:text-fg [&_strong]:font-semibold',
        '[&_em]:italic [&_em]:font-display',
        '[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-fg [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-fg [&_blockquote]:font-display [&_blockquote]:text-[19px] [&_blockquote]:leading-[1.5]',
        '[&_table]:my-6 [&_table]:w-full [&_table]:text-[14px] [&_table]:border [&_table]:border-fg/30',
        '[&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_th]:border-b [&_th]:border-fg [&_th]:text-fg [&_th]:font-semibold [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-[0.18em] [&_th]:bg-bg-elevated',
        '[&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border',
        '[&_hr]:my-10 [&_hr]:border-t-2 [&_hr]:border-fg/30',
      ].join(' ')}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
