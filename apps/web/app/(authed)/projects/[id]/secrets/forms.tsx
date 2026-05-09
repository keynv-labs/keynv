'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionState, useState } from 'react';
import {
  type SecretActionState,
  createSecretAction,
  deleteSecretAction,
  rotateSecretAction,
} from './actions';

export function CreateSecretForm({
  projectId,
  environments,
}: {
  projectId: string;
  environments: string[];
}) {
  const [state, action, pending] = useActionState<SecretActionState, FormData>(
    createSecretAction,
    {},
  );
  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="block">
        <span className="text-xs text-[var(--color-fg-muted)] block mb-1">Environment</span>
        <select
          name="env"
          required
          className="block w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-fg"
        >
          {environments.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-[var(--color-fg-muted)] block mb-1">Key</span>
        <Input name="key" required placeholder="db_password" pattern="^[a-z0-9][a-z0-9_-]{0,63}$" />
      </label>
      <label className="block md:col-span-2">
        <span className="text-xs text-[var(--color-fg-muted)] block mb-1">Value</span>
        <Input
          type="password"
          name="value"
          required
          placeholder="Sent over TLS, encrypted at rest."
          autoComplete="off"
        />
      </label>
      <div className="md:col-span-4 flex items-center justify-between">
        <div className="text-xs">
          {state.error ? (
            <span className="text-[var(--color-danger)]">{state.error}</span>
          ) : state.ok ? (
            <span className="text-[var(--color-success)]">{state.ok}</span>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add secret'}
        </Button>
      </div>
    </form>
  );
}

export function RotateSecretForm({
  projectId,
  env,
  keyName,
}: {
  projectId: string;
  env: string;
  keyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SecretActionState, FormData>(
    rotateSecretAction,
    {},
  );
  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Rotate
      </Button>
    );
  }
  return (
    <form
      action={(fd) => {
        action(fd);
        setOpen(false);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="env" value={env} />
      <input type="hidden" name="key" value={keyName} />
      <Input
        type="password"
        name="new_value"
        required
        placeholder="new value"
        autoComplete="off"
        className="w-44"
      />
      <Button type="submit" disabled={pending} variant="primary">
        {pending ? '…' : 'Save'}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {state.error ? (
        <span className="text-xs text-[var(--color-danger)]">{state.error}</span>
      ) : null}
    </form>
  );
}

export function DeleteSecretButton({
  projectId,
  env,
  keyName,
}: {
  projectId: string;
  env: string;
  keyName: string;
}) {
  return (
    <form
      action={async (fd) => {
        if (!confirm(`Delete @${env}.${keyName}? This cannot be undone.`)) return;
        await deleteSecretAction(fd);
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="env" value={env} />
      <input type="hidden" name="key" value={keyName} />
      <Button type="submit" variant="danger">
        Delete
      </Button>
    </form>
  );
}
