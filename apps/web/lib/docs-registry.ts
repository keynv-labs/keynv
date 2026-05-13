/**
 * Pure-data docs registry. NO node:fs imports — this module is safe
 * to import from Client Components (like the docs sidebar). The
 * server-side loaders live in lib/docs.ts.
 *
 * Explicit (not auto-walked) so internal files like
 * AUDIT-FINDINGS-PHASE5.md and UX-ROADMAP.md never accidentally ship
 * to the public site. Add a new section / page here when you publish
 * a new doc.
 *
 * `slug` is the path under /docs (may contain a `/`).
 * `file` is relative to the repo root (the same path you'd read on
 * GitHub).
 */

export interface DocPage {
  slug: string;
  file: string;
  title: string;
  summary?: string;
}

export interface DocSection {
  section: string;
  pages: DocPage[];
}

export const DOC_REGISTRY: ReadonlyArray<DocSection> = [
  {
    section: 'Getting started',
    pages: [
      {
        slug: 'quickstart',
        file: 'docs/quickstart.md',
        title: 'Quickstart',
        summary: 'Self-host keynv on Coolify and wire your first AI agent in 15 minutes.',
      },
      {
        slug: 'ai-setup',
        file: 'docs/ai-setup.md',
        title: 'Set up with your AI agent',
        summary:
          'Copy-paste prompts and AGENTS.md setup for Claude Code, Cursor, Aider, and any other agent.',
      },
    ],
  },
  {
    section: 'Concepts',
    pages: [
      {
        slug: 'architecture',
        file: 'docs/01-architecture.md',
        title: 'Architecture',
        summary: 'How the vault, CLI, MCP server, redactor, and audit chain fit together.',
      },
      {
        slug: 'threat-model',
        file: 'docs/02-threat-model.md',
        title: 'Threat model',
        summary: 'Adversary model, mitigations, and what we explicitly do not defend against.',
      },
      {
        slug: 'encryption-design',
        file: 'docs/05-encryption-design.md',
        title: 'Encryption design',
        summary: 'KEK / DEK envelope, key rotation, recovery, and why we picked libsodium + age.',
      },
    ],
  },
  {
    section: 'Reference',
    pages: [
      {
        slug: 'api',
        file: 'docs/06-api-spec.md',
        title: 'API specification',
        summary: 'The keynv-server HTTP surface (v1) — endpoints, payloads, error codes.',
      },
    ],
  },
  {
    section: 'Operations',
    pages: [
      {
        slug: 'roadmap',
        file: 'docs/ROADMAP.md',
        title: 'Roadmap',
        summary:
          'Phase tracker. What shipped, what is in progress, what is deliberately not started.',
      },
    ],
  },
  {
    section: 'Decisions',
    pages: [
      {
        slug: 'decisions/license-choice',
        file: 'docs/decisions/0001-license-choice.md',
        title: 'ADR-0001 · License choice',
        summary:
          'Why keynv is source-available today and MIT-licensed once the public API stabilizes.',
      },
    ],
  },
];

const FLAT_PAGES: DocPage[] = DOC_REGISTRY.flatMap((s) => s.pages);

export function allDocSlugs(): string[] {
  return FLAT_PAGES.map((p) => p.slug);
}

export function listAllPages(): Array<DocPage & { section: string }> {
  return DOC_REGISTRY.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.section })));
}

export function findDocPage(slug: string): { page: DocPage; section: string } | null {
  for (const sec of DOC_REGISTRY) {
    const page = sec.pages.find((p) => p.slug === slug);
    if (page) return { page, section: sec.section };
  }
  return null;
}

export function neighborPages(slug: string): {
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
} {
  const idx = FLAT_PAGES.findIndex((p) => p.slug === slug);
  if (idx < 0) return { prev: null, next: null };
  const prevPage = idx > 0 ? FLAT_PAGES[idx - 1] : null;
  const nextPage = idx < FLAT_PAGES.length - 1 ? FLAT_PAGES[idx + 1] : null;
  return {
    prev: prevPage ? { slug: prevPage.slug, title: prevPage.title } : null,
    next: nextPage ? { slug: nextPage.slug, title: nextPage.title } : null,
  };
}
