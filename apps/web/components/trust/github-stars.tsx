import { Github, Star } from 'lucide-react';

const REPO = 'keynv-labs/keynv';

interface Repo {
  stargazers_count: number;
}

async function fetchStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      next: { revalidate: 3600 },
      headers: { 'user-agent': 'keynv-web' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Repo;
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

function formatStars(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 100) / 10}k`;
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}

/**
 * Server component. Fetches the live star count with a 1-hour
 * revalidation window so the badge stays fresh without hammering
 * GitHub. Returns a static label if the API errors so we never
 * hard-fail the landing on an upstream blip.
 */
export async function GithubStars() {
  const stars = await fetchStars();
  return (
    <a
      href={`https://github.com/${REPO}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-elevated px-2 py-1 text-xs text-fg-muted hover:text-fg hover:border-border-strong transition-colors duration-fast ease-snap"
      aria-label={stars !== null ? `${REPO} on GitHub — ${stars} stars` : `${REPO} on GitHub`}
    >
      <Github size={12} strokeWidth={2} />
      <span className="font-medium text-fg">{REPO}</span>
      {stars !== null ? (
        <span className="inline-flex items-center gap-1 text-fg-subtle">
          <Star size={11} strokeWidth={2} className="text-warn" />
          {formatStars(stars)}
        </span>
      ) : null}
    </a>
  );
}
