'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionState } from 'react';
import { type CreateProjectState, createProjectAction } from './actions';

export function CreateProjectForm() {
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(
    createProjectAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="block">
        <span className="text-xs text-[var(--color-fg-muted)] block mb-1">Name (kebab-case)</span>
        <Input
          name="name"
          required
          placeholder="billing"
          pattern="^[a-z0-9][a-z0-9-]*$"
          minLength={1}
          maxLength={48}
        />
      </label>
      <label className="block">
        <span className="text-xs text-[var(--color-fg-muted)] block mb-1">Environments</span>
        <Input
          name="environments"
          required
          defaultValue="dev,prod:production:approval"
          placeholder="dev,prod:production:approval"
        />
        <span className="text-xs text-[var(--color-fg-muted)] block mt-1">
          Comma-separated. Format: <span className="mono">name[:tier[:approval]]</span>. Tier is{' '}
          <span className="mono">production</span> or <span className="mono">non-production</span>{' '}
          (default). Append <span className="mono">:approval</span> to require lead sign-off for
          developer reads.
        </span>
      </label>
      {state.error ? <p className="text-xs text-[var(--color-danger)]">{state.error}</p> : null}
      <div className="flex gap-2 mt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}
