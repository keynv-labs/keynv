import 'server-only';
import { type DocPage, findDocPage, neighborPages } from './docs-registry';
import { readRepoFile } from './markdown';

/**
 * Server-side docs loader. Imports node:fs via markdown.ts, so it's
 * forbidden from Client Components — `import 'server-only'` enforces
 * the boundary at compile time. The pure-data registry lives in
 * lib/docs-registry.ts for use from anywhere.
 */

export interface ResolvedDoc {
  page: DocPage;
  section: string;
  raw: string;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

export async function loadDoc(slug: string): Promise<ResolvedDoc | null> {
  const hit = findDocPage(slug);
  if (!hit) return null;
  const raw = await readRepoFile(hit.page.file);
  const { prev, next } = neighborPages(slug);
  return { page: hit.page, section: hit.section, raw, prev, next };
}

export { allDocSlugs, listAllPages } from './docs-registry';
