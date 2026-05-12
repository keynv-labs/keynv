import { parseChangelog, readRepoFile } from '@/lib/markdown';

/**
 * RSS 2.0 feed of the changelog. Generated at build time (the route
 * is static — same source data as /changelog) so the file lives in
 * the build output and serves with public cache headers.
 */

export const dynamic = 'force-static';

const SITE = 'https://keynv.dev';
const FEED_URL = `${SITE}/changelog/rss.xml`;
const SELF_LINK_REL = `<atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />`;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDateOrFallback(date: string | null): string {
  if (!date) return new Date().toUTCString();
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return new Date().toUTCString();
  return parsed.toUTCString();
}

export async function GET() {
  const raw = await readRepoFile('CHANGELOG.md');
  const { sections } = parseChangelog(raw);

  const lastBuildDate =
    sections.length > 0 ? isoDateOrFallback(sections[0]?.date ?? null) : new Date().toUTCString();

  const items = sections
    .map((s) => {
      const link = `${SITE}/changelog#${s.anchor}`;
      return `    <item>
      <title>${escapeXml(s.version)}${s.date ? ` — ${escapeXml(s.date)}` : ''}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${isoDateOrFallback(s.date)}</pubDate>
      <description>${escapeXml(s.bodyMarkdown.trim().slice(0, 1200))}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>keynv changelog</title>
    <link>${SITE}/changelog</link>
    <description>What shipped, when, and why — every release of keynv.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    ${SELF_LINK_REL}
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=3600',
    },
  });
}
