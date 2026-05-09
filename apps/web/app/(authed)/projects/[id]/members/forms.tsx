'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionState } from 'react';
import { type MemberActionState, addMemberAction, removeMemberAction } from './actions';

export function AddMemberForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(addMemberAction, {});
  return (
    <form action={action} className="flex flex-col md:flex-row gap-2 items-end">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="flex-1 block">
        <span className="text-xs text-[var(--color-fg-muted)] block mb-1">Email</span>
        <Input type="email" name="email" required placeholder="alice@team.com" />
      </label>
      <label className="block">
        <span className="text-xs text-[var(--color-fg-muted)] block mb-1">Role</span>
        <select
          name="role"
          defaultValue="developer"
          className="block w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-fg"
        >
          <option value="lead">lead</option>
          <option value="developer">developer</option>
          <option value="reader">reader</option>
        </select>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add'}
      </Button>
      {state.error ? (
        <span className="text-xs text-[var(--color-danger)]">{state.error}</span>
      ) : state.ok ? (
        <span className="text-xs text-[var(--color-success)]">{state.ok}</span>
      ) : null}
    </form>
  );
}

export function RemoveMemberButton({
  projectId,
  userId,
  email,
}: {
  projectId: string;
  userId: string;
  email: string;
}) {
  return (
    <form
      action={async (fd) => {
        if (!confirm(`Remove ${email} from this project?`)) return;
        await removeMemberAction(fd);
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="user_id" value={userId} />
      <Button type="submit" variant="ghost">
        Remove
      </Button>
    </form>
  );
}
