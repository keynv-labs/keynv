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
    <form action={action} className="space-y-4">
      <Field
        label="Name"
        hint={
          <>
            Lowercase, kebab-case. Used in alias paths like{' '}
            <code className="font-mono text-fg-muted">@&lt;name&gt;.dev.&lt;key&gt;</code>.
          </>
        }
      >
        <Input
          name="name"
          required
          placeholder="billing"
          pattern="^[a-z0-9][a-z0-9-]*$"
          minLength={1}
          maxLength={48}
          autoFocus
        />
      </Field>

      <Field
        label="Environments"
        hint={
          <>
            Comma-separated. Format:{' '}
            <code className="font-mono text-fg-muted">name[:tier[:approval]]</code>. Tier is{' '}
            <code className="font-mono text-fg-muted">production</code> or{' '}
            <code className="font-mono text-fg-muted">non-production</code> (default). Append{' '}
            <code className="font-mono text-fg-muted">:approval</code> to require lead sign-off for
            developer reads.
          </>
        }
      >
        <Input
          name="environments"
          required
          defaultValue="dev,prod:production:approval"
          placeholder="dev,prod:production:approval"
        />
      </Field>

      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create project'}
        </Button>
      </div>
    </form>
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
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle mb-1.5">
        {label}
      </span>
      {children}
      {hint ? <span className="block mt-1.5 text-xs text-fg-muted">{hint}</span> : null}
    </label>
  );
}
