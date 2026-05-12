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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import {
  Check,
  Copy,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCog,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import {
  type UserActionState,
  changeUserRoleAction,
  inviteUserAction,
  removeUserAction,
} from './actions';

interface OrgUser {
  id: string;
  email: string;
  org_role: string;
  created_at: string;
}

const roleTone = (role: string) => {
  if (role === 'owner') return 'accent' as const;
  if (role === 'admin') return 'success' as const;
  if (role === 'reader') return 'neutral' as const;
  return 'neutral' as const;
};

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function UsersClient({
  users,
  currentUserId,
}: {
  users: OrgUser[];
  currentUserId: string;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || u.org_role.toLowerCase().includes(q),
    );
  }, [users, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            strokeWidth={2}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by email or role…"
            className="pl-8"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            <span className="text-fg tabular">{filtered.length}</span> of{' '}
            <span className="tabular">{users.length}</span>
          </span>
          <InviteUserDialog />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center text-sm text-fg-muted">
          {users.length === 0 ? 'No users yet.' : 'No users match that filter.'}
        </div>
      ) : (
        <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {filtered.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
            >
              <span
                aria-hidden
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-strong bg-bg-inset font-mono text-[12px] font-semibold text-fg"
              >
                {u.email.slice(0, 2).toUpperCase()}
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-fg truncate">
                  {u.email}
                  {u.id === currentUserId ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                      · you
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-fg-subtle mt-0.5 font-mono tabular">
                  joined {formatRelative(u.created_at)}
                </div>
              </div>

              <Badge tone={roleTone(u.org_role)}>{u.org_role}</Badge>

              <UserRowMenu user={u} disabled={u.id === currentUserId || u.org_role === 'owner'} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UserRowMenu({ user, disabled }: { user: OrgUser; disabled: boolean }) {
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

      {/* Reserved hook for a future role-change confirmation modal — for
          now changes go through the inline form below. */}
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
        void changeUserRoleAction(fd);
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

// Avoids ambiguous-looking glyphs (I/l/0/O/1) so the temp password is
// transcribable when the admin shares it with the new user.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateTempPassword(length = 16): string {
  const buf = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  const alpha = PASSWORD_ALPHABET;
  let out = '';
  for (const b of buf) {
    out += alpha[b % alpha.length] ?? '';
  }
  return out;
}

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<UserActionState, FormData>(inviteUserAction, {});

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  // Regenerate on every open so the password isn't reused if the
  // dialog is reopened after a previous invite.
  useEffect(() => {
    if (open) {
      setPassword(generateTempPassword());
      setCopied(false);
    }
  }, [open]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be denied in non-https; user can select manually */
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus size={14} strokeWidth={2.25} />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Invite user</DialogTitle>
        <DialogDescription>
          Email invitations are on the roadmap. For now, share this temporary password with the new
          user out-of-band; they change it on first login.
        </DialogDescription>

        <form action={action} className="mt-4 space-y-3">
          <Field label="Email">
            <Input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="off"
              placeholder="alice@team.com"
            />
          </Field>

          <Field
            label="Temporary password"
            hint="Auto-generated, 16 chars. Click ↻ to roll a new one."
          >
            <div className="flex items-stretch gap-1.5">
              <Input
                type="text"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <button
                type="button"
                onClick={() => setPassword(generateTempPassword())}
                aria-label="Regenerate password"
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-elevated text-fg-muted hover:bg-bg-elevated-hover hover:text-fg hover:border-border-strong transition-colors duration-fast ease-snap"
              >
                <RefreshCw size={13} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={onCopy}
                aria-label="Copy password"
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-elevated text-fg-muted hover:bg-bg-elevated-hover hover:text-fg hover:border-border-strong transition-colors duration-fast ease-snap"
              >
                {copied ? (
                  <Check size={13} strokeWidth={2.25} className="text-success" />
                ) : (
                  <Copy size={13} strokeWidth={2} />
                )}
              </button>
            </div>
          </Field>

          <Field label="Org role">
            <select
              name="org_role"
              defaultValue="developer"
              className="block h-9 w-full rounded-md border border-border bg-bg-inset px-3 text-sm text-fg hover:border-border-strong focus:border-border-bright transition-colors duration-fast ease-snap"
            >
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
              <option value="reader">Reader</option>
            </select>
          </Field>

          {state.error ? (
            <p className="rounded-md border border-danger-soft-border bg-danger-soft px-3 py-2 text-xs text-danger">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Invite user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveUserDialog({
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
            await removeUserAction(fd);
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
