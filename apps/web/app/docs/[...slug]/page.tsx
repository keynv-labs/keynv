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
    <article>
      <nav className="text-xs text-fg-subtle flex items-center gap-1.5">
        <Link href={{ pathname: '/docs' }} className="hover:text-fg">
          Docs
        </Link>
        <span aria-hidden>/</span>
        <span className="text-fg-muted">{doc.section}</span>
      </nav>

      <Prose markdown={doc.raw} />

      <hr className="my-10 border-border" />

      <div className="flex items-center justify-between gap-4 flex-wrap text-sm">
        {doc.prev ? (
          <Link
            href={{ pathname: `/docs/${doc.prev.slug}` } as never}
            className="flex items-center gap-2 text-fg-muted hover:text-fg transition-colors duration-fast ease-snap"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            <span>
              <span className="text-fg-subtle text-[11px] uppercase tracking-wider block">
                Previous
              </span>
              <span className="font-medium">{doc.prev.title}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {doc.next ? (
          <Link
            href={{ pathname: `/docs/${doc.next.slug}` } as never}
            className="flex items-center gap-2 text-right text-fg-muted hover:text-fg transition-colors duration-fast ease-snap"
          >
            <span>
              <span className="text-fg-subtle text-[11px] uppercase tracking-wider block">
                Next
              </span>
              <span className="font-medium">{doc.next.title}</span>
            </span>
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        ) : null}
      </div>

      <div className="mt-10 flex items-center justify-end">
        <a href={githubUrl} target="_blank" rel="noreferrer">
          <Button variant="secondary" size="sm" className="gap-1.5">
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
    <div className="prose-keynv text-sm text-fg-muted leading-relaxed [&_h1]:text-fg [&_h1]:text-3xl [&_h1]:md:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:leading-tight [&_h1]:mt-0 [&_h1]:mb-3 [&_h2]:text-fg [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-20 [&_h3]:text-fg [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:scroll-mt-20 [&_h4]:text-fg [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-5 [&_h4]:mb-1.5 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3 [&_ol]:space-y-1.5 [&_li]:leading-relaxed [&_a]:text-fg [&_a]:underline [&_a]:decoration-fg-subtle hover:[&_a]:decoration-fg [&_code]:font-mono [&_code]:text-fg [&_code]:bg-bg-elevated [&_code]:border [&_code]:border-border [&_code]:rounded [&_code]:px-1 [&_code]:py-px [&_code]:text-[0.9em] [&_pre]:my-4 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-bg-elevated [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre>code]:bg-transparent [&_pre>code]:border-0 [&_pre>code]:p-0 [&_strong]:text-fg [&_strong]:font-semibold [&_em]:italic [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:text-fg-muted [&_table]:my-4 [&_table]:w-full [&_table]:text-xs [&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_th]:border-b [&_th]:border-border [&_th]:text-fg [&_th]:font-semibold [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border [&_hr]:my-8 [&_hr]:border-border">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
