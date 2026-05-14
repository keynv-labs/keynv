'use client';

import { describeEvent, relativeTime } from '@/components/audit/event';
import { cn } from '@/lib/cn';
import { FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type SecretHistoryState, loadSecretHistoryAction } from '../_actions/history-action';
import type { ParsedSecret } from './secrets-table';

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </div>
      <div className={cn('mt-0.5 text-xs text-fg', mono ? 'font-mono tabular' : '')}>{value}</div>
    </div>
  );
}

export function SecretHistoryPanel({
  alias,
  projectId,
  secret,
}: {
  alias: string;
  projectId: string;
  secret: ParsedSecret;
}) {
  const [state, setState] = useState<SecretHistoryState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSecretHistoryAction(alias)
      .then((result) => {
        if (!cancelled) {
          setState(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ error: (err as Error).message || 'Could not load history.' });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [alias]);

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
      <div>
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-3 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
          recent history
        </div>
        {loading || state === null ? (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Loader2 size={12} className="animate-spin" />
            Loading recent events…
          </div>
        ) : state.error ? (
          <div className="text-xs text-danger">{state.error}</div>
        ) : (state.entries?.length ?? 0) === 0 ? (
          <div className="text-xs text-fg-muted">
            No recent events for this alias in the last 200 audit entries.{' '}
            <Link
              href={{ pathname: `/projects/${projectId}/audit`, query: { alias } }}
              className="text-accent hover:underline"
            >
              View full audit ↗
            </Link>
          </div>
        ) : (
          <ol className="space-y-2.5">
            {state.entries?.map((e) => {
              const description = describeEvent(e.event_type, e.payload);
              return (
                <li key={e.id} className="flex items-start gap-3 text-xs">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 rounded-full shrink-0',
                      description.tone === 'danger'
                        ? 'bg-danger'
                        : description.tone === 'warn'
                          ? 'bg-warn'
                          : description.tone === 'success'
                            ? 'bg-success'
                            : 'bg-accent',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-fg">
                      <span className="font-mono text-fg-muted">{e.actor_user_id ?? 'system'}</span>
                      <span className="mx-1.5 text-fg-muted">{description.verb}</span>
                      <span className="font-mono text-accent">{alias}</span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 font-mono text-[10px] tabular text-fg-subtle"
                    title={new Date(e.ts).toLocaleString()}
                  >
                    {relativeTime(e.ts)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <div className="mt-4">
          <Link
            href={{ pathname: `/projects/${projectId}/audit`, query: { alias } }}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
          >
            <FileText size={11} strokeWidth={2} />
            full audit for this alias →
          </Link>
        </div>
      </div>

      <aside className="space-y-3">
        <Meta label="Version" value={`v${secret.version}`} mono />
        <Meta label="Created" value={new Date(secret.created_at).toLocaleString()} />
        <Meta label="Key" value={secret.keyName} mono />
        <Meta label="Environment" value={secret.env} mono />
        <div className="pt-2">
          <code className="block rounded border border-border bg-bg-inset px-2.5 py-1.5 font-mono text-[11px] text-fg tabular break-all">
            <span className="text-fg-subtle">$ </span>keynv exec --{' '}
            <span className="text-accent">{alias}</span>
          </code>
        </div>
      </aside>
    </div>
  );
}
