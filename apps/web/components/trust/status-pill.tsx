import { env } from '@/lib/env';

type Status = 'operational' | 'degraded' | 'unreachable';

interface HealthResponse {
  ok: boolean;
}

async function probe(): Promise<Status> {
  try {
    const res = await fetch(`${env.KEYNV_SERVER_URL}/v1/health`, {
      next: { revalidate: 60 },
      headers: { 'user-agent': 'keynv-web' },
    });
    if (!res.ok) return 'degraded';
    const data = (await res.json()) as HealthResponse;
    return data.ok === true ? 'operational' : 'degraded';
  } catch {
    return 'unreachable';
  }
}

const TONE: Record<Status, { dot: string; label: string }> = {
  operational: { dot: 'bg-success', label: 'All systems operational' },
  degraded: { dot: 'bg-warn', label: 'Investigating' },
  unreachable: { dot: 'bg-danger', label: 'API unreachable' },
};

/**
 * Server component. Probes /v1/health on the configured API with a
 * 60-second revalidation window. Renders a tiny pill that doubles as
 * a trust signal — visitors see the team running a live healthcheck
 * against their own service.
 */
export async function StatusPill() {
  const status = await probe();
  const tone = TONE[status];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-inset px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted"
      aria-label={`API status: ${tone.label}`}
    >
      <span className="relative inline-flex">
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
        <span
          className={`absolute inset-0 rounded-full ${tone.dot} opacity-60 animate-ping motion-reduce:hidden`}
          aria-hidden
        />
      </span>
      {tone.label}
    </span>
  );
}
