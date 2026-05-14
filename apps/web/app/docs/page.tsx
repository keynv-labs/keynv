import { Button } from '@/components/ui/button';
import { DOC_REGISTRY } from '@/lib/docs-registry';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
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
      <div className="display-eyebrow mb-3">documentation · self-host & integrate</div>
      <h1 className="display text-3xl md:text-[42px] tracking-tight leading-[1.05]">
        Operator guides &
        <br />
        <span className="text-fg-muted">threat-model reference.</span>
      </h1>
      <p className="mt-6 text-base text-fg-muted leading-relaxed max-w-2xl">
        Everything you need to self-host keynv, integrate it with your AI coding agent, and reason
        about what it does and doesn&rsquo;t defend against.
      </p>

      <div className="mt-12 space-y-10">
        {DOC_REGISTRY.map((section, idx) => (
          <section key={section.section}>
            <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle flex items-center gap-2">
              <span className="font-mono text-fg/40 tabular">
                {String(idx + 1).padStart(2, '0')}
              </span>
              {section.section}
            </h2>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {section.pages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/docs/${page.slug}`}
                    className="group block rounded-lg border border-border bg-bg-elevated p-5 hover:border-border-strong hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-fg font-semibold tracking-tight">{page.title}</div>
                      <ArrowUpRight
                        size={14}
                        strokeWidth={2}
                        className="shrink-0 text-fg-subtle group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-fast ease-snap"
                      />
                    </div>
                    {page.summary ? (
                      <p className="mt-2 text-sm text-fg-muted leading-relaxed">{page.summary}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-16 rounded-xl border border-border bg-bg-elevated p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-fg font-semibold tracking-tight">Want everything in one file?</div>
          <p className="mt-1 text-sm text-fg-muted">
            The full source lives on GitHub alongside the code.
          </p>
        </div>
        <a
          href="https://github.com/keynv-labs/keynv/tree/main/docs"
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="outline" className="gap-1.5">
            View on GitHub
            <ArrowRight size={13} strokeWidth={2.25} />
          </Button>
        </a>
      </div>
    </div>
  );
}
