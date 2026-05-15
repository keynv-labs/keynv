'use client';

import { CsrfField } from '@/components/security/csrf-field';
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
import { Check, Copy, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { type UserActionState, inviteUserAction } from '../_actions/actions';
import { Field } from './field';

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

interface OrgOption {
  id: string;
  name: string;
}

export function InviteUserDialog({
  orgs,
  activeOrgId,
}: {
  orgs: OrgOption[];
  activeOrgId: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<UserActionState, FormData>(inviteUserAction, {});
  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];
  const showOrgPicker = orgs.length > 1;

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

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
          <CsrfField />

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
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setPassword(generateTempPassword())}
                aria-label="Regenerate password"
                className="h-9 w-9 shrink-0 px-0 text-fg-muted"
              >
                <RefreshCw size={13} strokeWidth={2} />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onCopy}
                aria-label="Copy password"
                className="h-9 w-9 shrink-0 px-0 text-fg-muted"
              >
                {copied ? (
                  <Check size={13} strokeWidth={2.25} className="text-success" />
                ) : (
                  <Copy size={13} strokeWidth={2} />
                )}
              </Button>
            </div>
          </Field>

          {showOrgPicker ? (
            <Field
              label="Organization"
              hint="You belong to multiple orgs — pick which one this user joins."
            >
              <Select name="org_id" defaultValue={activeOrgId}>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </Select>
            </Field>
          ) : activeOrg ? (
            <div className="text-xs text-fg-subtle">
              Inviting to <span className="text-fg">{activeOrg.name}</span>.
            </div>
          ) : null}

          <Field label="Org role">
            <Select name="org_role" defaultValue="developer">
              <SelectItem value="admin">Admin</SelectItem>
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
              {pending ? 'Creating…' : 'Invite user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
