'use client';

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { type VerifyState, verifyChainAction } from '@/app/(authed)/projects/[id]/audit/actions';

export function ChainBanner() {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyChainAction, {});

  const tone = state.error
    ? 'error'
    : state.ok === true
      ? 'verified'
      : state.ok === false
        ? 'broken'
        : 'idle';

  return (
    <div
      className={
        tone === 'broken'
          ? 'rounded-lg border border-[color-mix(in_oklab,var(--color-danger)_30%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-danger)_8%,transparent)] p-4'
          : tone === 'verified'
            ? 'rounded-lg border border-[color-mix(in_oklab,var(--color-success)_30%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-success)_8%,transparent)] p-4'
            : 'rounded-lg border border-border bg-bg-elevated p-4'
      }
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg"
        >
          {tone === 'broken' ? (
            <AlertTriangle size={16} className="text-danger" strokeWidth={2} />
          ) : (
            <ShieldCheck
              size={16}
              className={tone === 'verified' ? 'text-success' : 'text-fg-muted'}
              strokeWidth={2}
            />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-fg">
            {tone === 'broken' ? 'Chain integrity broken' : 'Audit chain'}
          </div>
          <div className="text-xs text-fg-muted mt-0.5">
            {tone === 'verified' ? (
              <>
                Verified{' '}
                <span className="tabular-nums text-fg">{state.checked}</span>{' '}
                {state.checked === 1 ? 'entry' : 'entries'}. Hash chain is intact.
              </>
            ) : tone === 'broken' ? (
              <>
                First mismatch at id{' '}
                <span className="font-mono text-fg">{state.broken_at_id}</span>
                {state.reason ? (
                  <>
                    {' · '}
                    {state.reason}
                  </>
                ) : null}
                . Investigate before trusting any entry past that point.
              </>
            ) : tone === 'error' ? (
              <span className="text-danger">{state.error}</span>
            ) : (
              <>Tamper-evident log. Recompute the hash chain to confirm no entry has been altered.</>
            )}
          </div>
        </div>

        <form action={action}>
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? 'Verifying…' : 'Re-verify'}
          </Button>
        </form>
      </div>
    </div>
  );
}
