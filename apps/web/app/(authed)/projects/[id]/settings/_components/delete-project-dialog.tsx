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
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { deleteProjectAction } from '../_actions/project-actions';

export function DeleteProjectDialog({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');

  const canDelete = confirm === projectName;

  return (
    <>
      <div className="pt-4 border-t border-border">
        <div className="rounded-xl border border-danger-soft-border bg-danger-soft p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-danger">Danger zone</h4>
              <p className="text-xs text-fg-muted mt-1">
                Deleting <span className="font-mono text-fg">{projectName}</span> removes all its
                secrets and environments. This action is irreversible.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
              <Trash2 size={14} strokeWidth={2} className="mr-1.5" />
              Delete project
            </Button>
          </div>
        </div>
      </div>

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
              <AlertDialogTitle>Delete this project?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes <span className="font-mono text-fg">{projectName}</span> and
                every secret, environment, and member relationship tied to it.
              </AlertDialogDescription>
            </div>
          </div>

          <form
            action={async (fd) => {
              const result = await deleteProjectAction({}, fd);
              if (result?.error) {
                setOpen(false);
              }
            }}
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="project_id" value={projectId} />

            <label className="block">
              <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-2">
                Type <span className="text-danger">{projectName}</span> to confirm
              </span>
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={projectName}
                autoFocus
                autoComplete="off"
              />
            </label>

            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="submit" variant="danger" disabled={!canDelete}>
                  Delete project
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
