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
import { Trash2 } from 'lucide-react';
import { removeUserAction } from '../_actions/actions';

export function RemoveUserDialog({
  open,
  onOpenChange,
  userId,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  email: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-danger-soft-border bg-danger-soft"
          >
            <Trash2 size={16} className="text-danger" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <AlertDialogTitle>Remove this user from the org?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-fg">{email}</span> loses access to every project.
              Their refresh tokens are revoked. The user record is deleted; this is irreversible.
            </AlertDialogDescription>
          </div>
        </div>

        <form
          action={async (fd) => {
            await removeUserAction({}, fd);
            onOpenChange(false);
          }}
          className="mt-5"
        >
          <input type="hidden" name="user_id" value={userId} />

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="submit" variant="danger">
                Remove user
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
