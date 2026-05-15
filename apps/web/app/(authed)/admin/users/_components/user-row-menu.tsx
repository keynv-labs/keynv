'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { MoreHorizontal, Trash2, UserCog } from 'lucide-react';
import { useState } from 'react';
import { changeUserRoleAction } from '../_actions/actions';
import { RemoveUserDialog } from './remove-dialog';

interface OrgUser {
  id: string;
  email: string;
  org_role: string;
  created_at: string;
}

export function UserRowMenu({ user, disabled }: { user: OrgUser; disabled: boolean }) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${user.email}`}
            disabled={disabled}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-elevated-hover hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-fast ease-snap"
          >
            <MoreHorizontal size={15} strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Role</DropdownMenuLabel>
          <RoleItem user={user} targetRole="admin" />
          <RoleItem user={user} targetRole="developer" />
          <RoleItem user={user} targetRole="reader" />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setRemoveOpen(true)}
            className="text-danger data-[highlighted]:text-danger"
          >
            <Trash2 size={13} />
            Remove from org
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RemoveUserDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        userId={user.id}
        email={user.email}
      />

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogTitle>Reserved</DialogTitle>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RoleItem({
  user,
  targetRole,
}: {
  user: OrgUser;
  targetRole: 'admin' | 'developer' | 'reader';
}) {
  const isCurrent = user.org_role === targetRole;
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        if (isCurrent) return;
        const fd = new FormData();
        fd.set('user_id', user.id);
        fd.set('org_role', targetRole);
        void changeUserRoleAction({}, fd);
      }}
      className={cn(
        'capitalize',
        isCurrent && 'text-fg-subtle data-[highlighted]:text-fg-subtle pointer-events-none',
      )}
    >
      <UserCog size={13} className="text-fg-muted" />
      {targetRole}
      {isCurrent ? <span className="ml-auto text-[11px] text-fg-subtle">current</span> : null}
    </DropdownMenuItem>
  );
}
