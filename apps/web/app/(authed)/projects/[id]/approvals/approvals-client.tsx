'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { Check, ShieldAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import { type GrantState, denyApprovalAction, grantApprovalAction } from './actions';

export interface ApprovalRow {
  id: string;
  alias: string;
  status: 'pending' | 'granted' | 'denied' | 'expired';
  reason: string | null;
  requester_user_id: string;
  requester_email: string | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  expires_at: string | null;
  created_at: string;
}

type StatusFilter = 'all' | 'pending' | 'granted' | 'denied' | 'expired';

const STATUS_TONE = {
  pending: 'warn',
  granted: 'success',
  denied: 'danger',
  expired: 'neutral',
} as const;

function relative(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatExpiresIn(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = ts - Date.now();
  if (diff <= 0) return 'expired';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export function ApprovalsClient({
  projectId,
  approvals,
  canDecide,
}: {
  projectId: string;
  approvals: ApprovalRow[];
  canDecide: boolean;
}) {
  const [filter, setFilter] = useState<StatusFilter>('pending');

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: approvals.length,
      pending: 0,
      granted: 0,
      denied: 0,
      expired: 0,
    };
    for (const a of approvals) c[a.status]++;
    return c;
  }, [approvals]);

  const filtered = useMemo(() => {
    if (filter === 'all') return approvals;
    return approvals.filter((a) => a.status === filter);
  }, [approvals, filter]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warn-soft-border bg-warn-soft p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-warn-soft-border bg-bg-inset"
          >
            <ShieldAlert size={16} className="text-warn" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-fg">Production-access approvals</div>
            <div className="text-xs text-fg-muted mt-1 leading-relaxed">
              When a developer hits a secret in an environment marked{' '}
              <span className="font-mono text-accent">require_approval</span>, a pending row appears
              here. Lead / admin / owner grant or deny.
              {canDecide ? null : (
                <>
                  {' '}
                  <span className="text-fg-subtle">
                    You don&rsquo;t have grant rights on this project — view only.
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(['pending', 'granted', 'denied', 'expired', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em]',
              'transition-colors duration-fast ease-snap',
              filter === s
                ? 'border-accent-soft-border bg-accent-soft text-accent'
                : 'border-border bg-bg-elevated text-fg-muted hover:text-fg hover:border-border-strong',
            )}
          >
            {s}
            <span className="text-fg-subtle tabular">{counts[s]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center text-sm text-fg-muted">
          {filter === 'all' || filter === 'pending'
            ? 'No approvals yet. They appear here automatically when a developer hits a require_approval secret.'
            : `No ${filter} approvals.`}
        </div>
      ) : (
        <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {filtered.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
            >
              <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>

              <div className="flex-1 min-w-0">
                <div className="font-mono text-[13px] text-fg break-all tabular">
                  <span className="text-accent">@</span>
                  {a.alias.replace(/^@/, '')}
                </div>
                <div className="text-[11px] text-fg-subtle mt-1 font-mono tabular">
                  requested by{' '}
                  <span className="text-fg-muted">{a.requester_email ?? a.requester_user_id}</span>
                  {' · '}
                  {relative(a.created_at)}
                  {a.status === 'granted' && a.expires_at ? (
                    <>
                      {' · '}
                      <span className="text-fg-muted">{formatExpiresIn(a.expires_at)}</span>
                    </>
                  ) : null}
                  {a.reason ? (
                    <>
                      {' · '}
                      <span className="italic">&ldquo;{a.reason}&rdquo;</span>
                    </>
                  ) : null}
                </div>
              </div>

              {a.status === 'pending' && canDecide ? (
                <div className="flex items-center gap-1.5">
                  <GrantDialog projectId={projectId} approvalId={a.id} alias={a.alias} />
                  <DenyDialog projectId={projectId} approvalId={a.id} alias={a.alias} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GrantDialog({
  projectId,
  approvalId,
  alias,
}: {
  projectId: string;
  approvalId: string;
  alias: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<GrantState, FormData>(grantApprovalAction, {});

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)} className="gap-1">
        <Check size={12} strokeWidth={2.25} />
        Grant
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Grant access</DialogTitle>
          <DialogDescription>
            Approving <span className="font-mono text-fg">{alias}</span>. The requester gains read
            access for the window below; after expiry they re-request.
          </DialogDescription>

          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="approval_id" value={approvalId} />

            <Field
              label="Window"
              hint="How long the grant stays active. Range: 1 minute to 7 days."
            >
              <Select name="expires_in_seconds" defaultValue="3600">
                <SelectItem value="900">15 minutes</SelectItem>
                <SelectItem value="3600">1 hour</SelectItem>
                <SelectItem value="14400">4 hours</SelectItem>
                <SelectItem value="86400">1 day</SelectItem>
                <SelectItem value="604800">7 days</SelectItem>
              </Select>
            </Field>

            <Field label="Reason (optional)" hint="Lands in the audit chain.">
              <Input
                name="reason"
                placeholder="e.g. one-off prod debug, ticket #4231"
                autoComplete="off"
                maxLength={500}
              />
            </Field>

            {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Granting…' : 'Grant access'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DenyDialog({
  projectId,
  approvalId,
  alias,
}: {
  projectId: string;
  approvalId: string;
  alias: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [state, action, pending] = useActionState<GrantState, FormData>(denyApprovalAction, {});

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setReason('');
    }
  }, [state.ok]);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="gap-1">
        <X size={12} strokeWidth={2.25} />
        Deny
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-danger-soft-border bg-danger-soft"
            >
              <X size={16} className="text-danger" strokeWidth={2.25} />
            </span>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle>Deny access?</AlertDialogTitle>
              <AlertDialogDescription>
                The requester will see this denial reason. They can re-request later.
              </AlertDialogDescription>
            </div>
          </div>

          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="approval_id" value={approvalId} />

            <Field
              label={
                <>
                  Reason for denying <span className="font-mono text-fg">{alias}</span>
                </>
              }
            >
              <Input
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                autoFocus
                placeholder="e.g. use staging instead, or ask for a 1Password share"
                autoComplete="off"
                maxLength={500}
              />
            </Field>

            {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}

            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="submit" variant="danger" disabled={pending || reason.trim() === ''}>
                  {pending ? 'Denying…' : 'Deny request'}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-2">
        {label}
      </span>
      {children}
      {hint ? <span className="block mt-1.5 text-xs text-fg-muted">{hint}</span> : null}
    </label>
  );
}
