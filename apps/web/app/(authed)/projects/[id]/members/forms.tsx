'use client';

import { Plus, Trash2 } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { type MemberActionState, addMemberAction, removeMemberAction } from './actions';

export function AddMemberDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(
    addMemberAction,
    {},
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus size={14} strokeWidth={2.25} />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add member</DialogTitle>
        <DialogDescription>
          The user must already exist in the org. Roles: <span className="font-mono text-fg">lead</span> can
          rotate &amp; share, <span className="font-mono text-fg">developer</span> can read &amp; write,{' '}
          <span className="font-mono text-fg">reader</span> can list metadata only.
        </DialogDescription>

        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="project_id" value={projectId} />

          <Field label="Email">
            <Input
              type="email"
              name="email"
              required
              placeholder="alice@team.com"
              autoComplete="off"
              autoFocus
            />
          </Field>

          <Field label="Role">
            <select
              name="role"
              defaultValue="developer"
              className="block h-8 w-full rounded-md border border-border bg-bg px-2.5 text-sm text-fg hover:border-border-strong transition-colors duration-fast ease-snap"
            >
              <option value="lead">Lead</option>
              <option value="developer">Developer</option>
              <option value="reader">Reader</option>
            </select>
          </Field>

          {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveMemberAction({
  projectId,
  userId,
  email,
}: {
  projectId: string;
  userId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Remove ${email}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-elevated-hover hover:text-danger transition-colors duration-fast ease-snap"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-danger)_14%,transparent)]"
            >
              <Trash2 size={16} className="text-danger" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle>Remove this member?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-mono text-fg">{email}</span> will lose access to this
                project. Their CLI tokens scoped to this project will fail on next read.
              </AlertDialogDescription>
            </div>
          </div>

          <form
            action={async (fd) => {
              await removeMemberAction(fd);
              setOpen(false);
            }}
            className="mt-5"
          >
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="user_id" value={userId} />

            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="submit" variant="danger">
                  Remove member
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
