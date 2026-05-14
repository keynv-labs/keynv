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
import { Button } from '@/components/ui/button';
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
import { Select, SelectItem } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { type MemberActionState, addMemberAction, removeMemberAction } from '../_actions/member-actions';

export function AddMemberDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(addMemberAction, {});

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
          The user must already exist in the org. Roles:{' '}
          <span className="font-mono text-fg">lead</span> can rotate &amp; share,{' '}
          <span className="font-mono text-fg">developer</span> can read &amp; write,{' '}
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
            <Select name="role" defaultValue="developer">
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="developer">Developer</SelectItem>
              <SelectItem value="reader">Reader</SelectItem>
            </Select>
          </Field>

          {state.error ? <ErrorBlock message={state.error} /> : null}

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
      <Tooltip content={`Remove ${email}`} side="left">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Remove ${email}`}
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
              <AlertDialogTitle>Remove this member?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-mono text-fg">{email}</span> will lose access to this project.
                Their CLI tokens scoped to this project will fail on next read.
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
      <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}
