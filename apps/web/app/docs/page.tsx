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
    <div>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
        Documentation
      </h1>
      <p className="mt-3 text-base text-fg-muted leading-relaxed max-w-2xl">
        Everything you need to self-host keynv, integrate it with your AI coding agent, and reason
        about what it does and doesn&rsquo;t defend against.
      </p>

      <div className="mt-10 space-y-10">
        {DOC_REGISTRY.map((section) => (
          <section key={section.section}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {section.section}
            </h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {section.pages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={{ pathname: `/docs/${page.slug}` } as never}
                    className="block rounded-lg border border-border bg-bg-elevated p-4 hover:border-border-strong hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
                  >
                    <div className="flex items-center gap-2 text-fg font-semibold tracking-tight">
                      {page.title}
                      <ArrowRight size={13} strokeWidth={2} className="text-fg-subtle" />
                    </div>
                    {page.summary ? (
                      <p className="mt-1.5 text-sm text-fg-muted leading-relaxed">{page.summary}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-16 rounded-lg border border-border bg-bg-elevated p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-fg font-semibold">Want everything in one file?</div>
          <p className="mt-1 text-sm text-fg-muted">
            The full source lives on GitHub alongside the code.
          </p>
        </div>
        <a
          href="https://github.com/keynv-labs/keynv/tree/main/docs"
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="secondary" className="gap-1.5">
            View on GitHub
            <ArrowRight size={13} strokeWidth={2.25} />
          </Button>
        </a>
      </div>
    </div>
  );
}
