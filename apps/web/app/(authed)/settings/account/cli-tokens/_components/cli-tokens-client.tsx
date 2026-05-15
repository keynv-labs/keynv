'use client';

import { CsrfField } from '@/components/security/csrf-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ErrorBlock } from '@/components/ui/error-block';
import { Input } from '@/components/ui/input';
import { LoadMoreButton } from '@/components/ui/load-more-button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/time';
import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useActionState } from 'react';
import {
  type CreateTokenState,
  createCliTokenAction,
  loadMoreCliTokensAction,
  revokeCliTokenAction,
} from '../_actions/actions';

export interface CliTokenRow {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export function CliTokensClient({
  tokens: initialTokens,
  nextCursor: initialCursor,
}: {
  tokens: CliTokenRow[];
  nextCursor: string | null;
}) {
  const [tokens, setTokens] = useState<CliTokenRow[]>(initialTokens);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (cursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await loadMoreCliTokensAction(cursor);
      setTokens((prev) => [...prev, ...result.tokens]);
      setCursor(result.next_cursor);
    } catch {
      // silent fail
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const active = tokens.filter((t) => !t.revoked_at);
  const revoked = tokens.filter((t) => t.revoked_at);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Long-lived tokens for headless agents, CI runners, and scripts. Each token has the same
          authority as your user. Revoke any you don&rsquo;t recognise immediately.
        </p>
        <CreateTokenDialog />
      </div>

      {active.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center">
          <KeyRound
            size={20}
            className="mx-auto mb-3 text-fg-subtle"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="text-sm text-fg-muted">No active CLI tokens.</p>
          <p className="text-xs text-fg-subtle mt-1">
            Create one to authenticate the keynv CLI without storing your password.
          </p>
        </div>
      ) : (
        <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {active.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
            >
              <span
                aria-hidden
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent-soft-border bg-accent-soft"
              >
                <KeyRound size={14} className="text-accent" strokeWidth={2} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-fg truncate font-medium">{t.name}</div>
                <div className="text-[11px] text-fg-subtle mt-0.5 font-mono tabular">
                  created {formatRelative(t.created_at)}
                  <span className="mx-2 text-fg-subtle/60">·</span>
                  used {formatRelative(t.last_used_at)}
                  {t.expires_at ? (
                    <>
                      <span className="mx-2 text-fg-subtle/60">·</span>
                      expires {new Date(t.expires_at).toLocaleDateString()}
                    </>
                  ) : null}
                </div>
              </div>

              <RevokeAction id={t.id} name={t.name} />
            </li>
          ))}
        </ul>
      )}

      {cursor !== null ? <LoadMoreButton loading={loadingMore} onClick={loadMore} /> : null}

      {revoked.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap select-none data-[state=open]:text-accent">
            show revoked ({revoked.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-fast">
            <ul className="mt-2 rounded-lg border border-border bg-bg-elevated/50 divide-y divide-border overflow-hidden opacity-70">
              {revoked.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 text-fg-muted line-through"
                >
                  <KeyRound size={14} className="text-fg-subtle shrink-0" strokeWidth={2} />
                  <span className="flex-1 min-w-0 text-sm truncate">{t.name}</span>
                  <span className="text-[11px] text-fg-subtle no-underline">
                    Revoked {formatRelative(t.revoked_at)}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

function CreateTokenDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateTokenState, FormData>(
    createCliTokenAction,
    {},
  );

  // Reset state when the dialog re-opens for a new token.
  useEffect(() => {
    if (open) return;
    // Defer reset to the next tick so the closing animation runs first.
    const t = setTimeout(() => {
      // Hack: trigger a remount of the action by closing and re-mounting.
      // Practical approach: we keep showing the most recent token until
      // the user explicitly acknowledges. Resetting here would discard
      // their copy. Leave state as-is.
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  const issued = state.ok ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus size={14} strokeWidth={2.25} />
          New token
        </Button>
      </DialogTrigger>
      <DialogContent>
        {issued ? (
          <>
            <DialogTitle>Copy your new token</DialogTitle>
            <DialogDescription>
              This is the only time the value will be shown. Use tokens for CI and other
              non-interactive automation. For your laptop, run the normal <code>keynv</code> TUI
              instead. If you lose this token, revoke it and create a new one.
            </DialogDescription>
            <RawTokenReveal token={issued.token} name={issued.name} />
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogTitle>New CLI token</DialogTitle>
            <DialogDescription>
              The token has the same authority as your user account. Use a label that lets you
              recognise where it&rsquo;s installed (e.g.{' '}
              <span className="font-mono text-fg">laptop-1</span>,{' '}
              <span className="font-mono text-fg">ci-runner</span>).
            </DialogDescription>

            <form action={action} className="mt-4 space-y-3">
              <CsrfField />

              <label className="block">
                <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-2">
                  Name
                </span>
                <Input
                  name="name"
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="laptop-1"
                  pattern="^[A-Za-z0-9][A-Za-z0-9 _.\-]*$"
                  maxLength={64}
                />
              </label>

              {state.error ? <ErrorBlock message={state.error} /> : null}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Creating…' : 'Create token'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RawTokenReveal({ token, name }: { token: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be denied; user can select manually */
    }
  };

  return (
    <div className="mt-4 space-y-2.5">
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        {name}
      </div>
      <div className="flex items-stretch gap-2">
        <code
          className={cn(
            'flex-1 min-w-0 rounded-md border border-accent-soft-border bg-bg-inset p-3',
            'font-mono text-[12px] text-fg break-all tabular',
          )}
        >
          {token}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            'shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md',
            'border border-border-strong bg-bg-elevated text-fg',
            'hover:bg-bg-elevated-hover hover:border-border-bright',
            'transition-colors duration-fast ease-snap',
          )}
          aria-label="Copy token"
        >
          {copied ? (
            <Check size={14} strokeWidth={2.25} className="text-success" />
          ) : (
            <Copy size={14} strokeWidth={2} />
          )}
        </button>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">
        copy now · will not be shown again
      </p>
    </div>
  );
}

function RevokeAction({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip content={`Revoke ${name}`} side="left">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Revoke ${name}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-elevated-hover hover:text-danger transition-colors duration-fast ease-snap"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </Tooltip>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-danger-soft-border bg-danger-soft"
            >
              <Trash2 size={16} className="text-danger" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-mono text-fg">{name}</span> will stop working immediately. Any
                agent using it (CI runner, headless service) will need to be re-issued. This is
                irreversible.
              </AlertDialogDescription>
            </div>
          </div>

          <form
            action={async (fd) => {
              await revokeCliTokenAction({}, fd);
              setOpen(false);
            }}
            className="mt-5"
          >
            <CsrfField />
            <input type="hidden" name="id" value={id} />

            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="submit" variant="danger">
                  Revoke token
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
