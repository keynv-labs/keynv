'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import {
  type SecretActionState,
  createSecretAction,
  deleteSecretAction,
  rotateSecretAction,
} from './actions';

interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSecretDialog({
  open,
  onOpenChange,
  projectId,
  environments,
}: DialogShellProps & { projectId: string; environments: string[] }) {
  const [state, action, pending] = useActionState<SecretActionState, FormData>(
    createSecretAction,
    {},
  );

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state.ok, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New secret</DialogTitle>
        <DialogDescription>
          The value is sent to the keynv server over TLS, encrypted at rest, and never displayed
          back. Resolve it with{' '}
          <code className="font-mono text-fg">keynv exec</code> from the CLI.
        </DialogDescription>

        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="project_id" value={projectId} />

          <Field label="Environment">
            <select
              name="env"
              required
              className="block h-8 w-full rounded-md border border-border bg-bg px-2.5 text-sm text-fg hover:border-border-strong transition-colors duration-fast ease-snap"
            >
              {environments.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Key">
            <Input
              name="key"
              required
              placeholder="db_password"
              pattern="^[a-z0-9][a-z0-9_-]{0,63}$"
              autoComplete="off"
            />
          </Field>

          <Field label="Value">
            <Input
              type="password"
              name="value"
              required
              placeholder="Sent over TLS, encrypted at rest"
              autoComplete="off"
            />
          </Field>

          {state.error ? (
            <p className="text-xs text-danger">{state.error}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add secret'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RotateSecretDialog({
  open,
  onOpenChange,
  projectId,
  env,
  keyName,
  alias,
}: DialogShellProps & {
  projectId: string;
  env: string;
  keyName: string;
  alias: string;
}) {
  const [state, action, pending] = useActionState<SecretActionState, FormData>(
    rotateSecretAction,
    {},
  );

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state.ok, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Rotate secret</DialogTitle>
        <DialogDescription>
          Replaces the value behind <span className="font-mono text-fg">{alias}</span> and bumps
          its version. Existing CLI sessions resolve the new value on next read.
        </DialogDescription>

        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="env" value={env} />
          <input type="hidden" name="key" value={keyName} />

          <Field label="New value">
            <Input
              type="password"
              name="new_value"
              required
              placeholder="New value"
              autoComplete="off"
              autoFocus
            />
          </Field>

          {state.error ? (
            <p className="text-xs text-danger">{state.error}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Rotating…' : 'Rotate secret'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSecretDialog({
  open,
  onOpenChange,
  projectId,
  env,
  keyName,
  alias,
}: DialogShellProps & {
  projectId: string;
  env: string;
  keyName: string;
  alias: string;
}) {
  const [confirmText, setConfirmText] = useState('');
  const expected = `${env}.${keyName}`;
  const matches = confirmText === expected;

  // reset typed text whenever the dialog re-opens
  useEffect(() => {
    if (!open) setConfirmText('');
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-danger)_14%,transparent)]"
          >
            <Trash2 size={16} className="text-danger" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <AlertDialogTitle>Delete this secret?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-fg">{alias}</span> and all its versions will be
              removed. This is permanent.
            </AlertDialogDescription>
          </div>
        </div>

        <form
          action={async (fd) => {
            await deleteSecretAction(fd);
            onOpenChange(false);
          }}
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="env" value={env} />
          <input type="hidden" name="key" value={keyName} />

          <Field
            label={
              <>
                Type <span className="font-mono text-fg">{expected}</span> to confirm
              </>
            }
          >
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expected}
              autoComplete="off"
              autoFocus
              className={cn(matches && 'border-danger')}
            />
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="submit" variant="danger" disabled={!matches}>
                Delete secret
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
