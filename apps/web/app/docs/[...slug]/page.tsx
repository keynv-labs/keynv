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
      <nav className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle flex items-center gap-1.5">
        <Link href={{ pathname: '/docs' }} className="hover:text-accent transition-colors">
          docs
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
            className="group flex items-center gap-3 text-fg-muted hover:text-fg transition-colors duration-fast ease-snap"
          >
            <ArrowLeft
              size={14}
              strokeWidth={2}
              className="shrink-0 group-hover:-translate-x-0.5 transition-transform duration-fast ease-snap"
            />
            <span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle block">
                previous
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
            className="group flex items-center gap-3 text-right text-fg-muted hover:text-fg transition-colors duration-fast ease-snap"
          >
            <span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle block">
                next
              </span>
              <span className="font-medium">{doc.next.title}</span>
            </span>
            <ArrowRight
              size={14}
              strokeWidth={2}
              className="shrink-0 group-hover:translate-x-0.5 transition-transform duration-fast ease-snap"
            />
          </Link>
        ) : null}
      </div>

      <div className="mt-10 flex items-center justify-end">
        <a href={githubUrl} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
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
    <div className="prose-keynv text-[15px] text-fg-muted leading-[1.7] [&_h1]:display [&_h1]:text-fg [&_h1]:text-3xl [&_h1]:md:text-[42px] [&_h1]:tracking-tight [&_h1]:leading-[1.05] [&_h1]:mt-4 [&_h1]:mb-4 [&_h2]:text-fg [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:scroll-mt-20 [&_h3]:text-fg [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:scroll-mt-20 [&_h4]:text-fg [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-6 [&_h4]:mb-1.5 [&_p]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-4 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-4 [&_ol]:space-y-2 [&_li]:leading-[1.7] [&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/40 hover:[&_a]:decoration-accent [&_code]:font-mono [&_code]:text-accent [&_code]:bg-bg-inset [&_code]:border [&_code]:border-border [&_code]:rounded [&_code]:px-1.5 [&_code]:py-px [&_code]:text-[0.88em] [&_pre]:my-5 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-bg-inset [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre>code]:bg-transparent [&_pre>code]:border-0 [&_pre>code]:p-0 [&_pre>code]:text-fg [&_strong]:text-fg [&_strong]:font-semibold [&_em]:italic [&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:text-fg [&_table]:my-5 [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:px-3 [&_th]:py-2.5 [&_th]:border-b [&_th]:border-border [&_th]:text-fg-subtle [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-[0.16em] [&_td]:px-3 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-border [&_hr]:my-10 [&_hr]:border-border">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
