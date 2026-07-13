'use client';

import { CsrfField } from '@/components/security/csrf-field';
import { cn } from '@/lib/cn';
import { notify } from '@/lib/toast';
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { type RevealActionState, revealSecretAction } from '../_actions/reveal-action';

const iconButton =
  'inline-flex w-8 items-center justify-center rounded border border-border text-fg-subtle hover:text-fg hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap';

/**
 * "Reveal value" control for the secret-detail panel. The plaintext is
 * fetched on demand (never shipped in the page payload); the underlying
 * endpoint enforces `secret.read` RBAC + the production-approval flow and
 * audits every reveal server-side.
 */
export function RevealSecret({
  projectId,
  env,
  keyName,
}: {
  projectId: string;
  env: string;
  keyName: string;
}) {
  const [state, action, pending] = useActionState<RevealActionState, FormData>(
    revealSecretAction,
    {},
  );
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const value = state.value;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyValue() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify.success('Copied value to clipboard');
    } catch {
      notify.error('Could not copy to clipboard');
    }
  }

  return (
    <div>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-1.5">
        Value
      </div>

      {value === undefined ? (
        <form action={action}>
          <CsrfField />
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="env" value={env} />
          <input type="hidden" name="key" value={keyName} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-inset px-2.5 py-1.5 text-xs text-fg hover:border-border-strong hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Revealing…
              </>
            ) : (
              <>
                <Eye size={12} strokeWidth={2} />
                Reveal value
              </>
            )}
          </button>
          {state.error ? <p className="mt-1.5 text-[11px] text-danger break-words">{state.error}</p> : null}
        </form>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-stretch gap-1.5">
            <code className="flex-1 min-w-0 rounded border border-border bg-bg-inset px-2.5 py-1.5 font-mono text-[11px] text-fg tabular break-all">
              {hidden ? '•'.repeat(Math.min(Math.max(value.length, 8), 24)) : value}
            </code>
            <button
              type="button"
              onClick={() => setHidden((h) => !h)}
              aria-label={hidden ? 'Show value' : 'Hide value'}
              className={iconButton}
            >
              {hidden ? <Eye size={13} strokeWidth={2} /> : <EyeOff size={13} strokeWidth={2} />}
            </button>
            <button type="button" onClick={copyValue} aria-label="Copy value" className={cn(iconButton)}>
              {copied ? (
                <Check size={13} strokeWidth={2} className="text-success" />
              ) : (
                <Copy size={13} strokeWidth={2} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-fg-subtle">This reveal was recorded in the audit log.</p>
        </div>
      )}
    </div>
  );
}
