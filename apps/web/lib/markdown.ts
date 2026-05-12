import { readFile } from 'node:fs/promises';

/**
 * Build-time markdown loading. Pages that consume these helpers must
 * be statically rendered (`export const dynamic = 'force-static'`)
 * so the fs reads happen at build, the rendered HTML is baked into
 * the static output, and the runtime container never needs the
 * source files. CHANGELOG.md and docs/ live at the repo root which
 * is outside the Docker build context for apps/web — inlining at
 * build time sidesteps the copying problem.
 *
 * Paths are resolved relative to this file via import.meta.url so
 * monorepo layout changes don't silently break the loaders.
 */

const HERE = new URL(import.meta.url);
const REPO_ROOT = new URL('../../../', HERE);

export function repoFile(relPath: string): URL {
  return new URL(relPath, REPO_ROOT);
}

export async function readRepoFile(relPath: string): Promise<string> {
  return readFile(repoFile(relPath), 'utf8');
}

export interface ChangelogSection {
  version: string;
  date: string | null;
  bodyMarkdown: string;
  anchor: string;
}

const HEADING_RE = /^##\s+\[?([^\]\s]+)\]?(?:\s*[—-]\s*([0-9-]+))?\s*$/;

/**
 * Splits the CHANGELOG body into per-version sections so the page
 * can render each as its own card and the RSS feed can emit one
 * entry per release.
 */
export function parseChangelog(raw: string): {
  intro: string;
  sections: ChangelogSection[];
} {
  const lines = raw.split('\n');
  const sections: ChangelogSection[] = [];
  const introLines: string[] = [];
  let current: ChangelogSection | null = null;
  let seenFirstH2 = false;

  for (const line of lines) {
    const match = line.match(HEADING_RE);
    if (match) {
      seenFirstH2 = true;
      if (current) sections.push(current);
      const version = match[1] ?? 'Unreleased';
      const date = match[2] ?? null;
      current = {
        version,
        date,
        bodyMarkdown: '',
        anchor: slugifyVersion(version),
      };
      continue;
    }
    if (!seenFirstH2) {
      introLines.push(line);
    } else if (current) {
      current.bodyMarkdown += `${line}\n`;
    }
  }
  if (current) sections.push(current);

  // Strip the leading H1 + Keep-a-Changelog boilerplate from intro
  while (introLines.length > 0) {
    const first = introLines[0];
    if (typeof first !== 'string') break;
    const trimmed = first.trim();
    if (trimmed.startsWith('#') || trimmed === '') {
      introLines.shift();
    } else {
      break;
    }
  }

  return {
    intro: introLines.join('\n').trim(),
    sections,
  };
}

function slugifyVersion(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
