'use client';

import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ErrorBlock, SuccessBlock } from '@/components/ui/error-block';
import { Input } from '@/components/ui/input';
import { useActionState } from 'react';
import { type OrgState, updateOrgAction } from './actions';

export function UpdateOrgForm() {
  const [state, action, pending] = useActionState<OrgState, FormData>(updateOrgAction, {});

  return (
    <form action={action} className="space-y-5">
      <Card>
        <CardTitle>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Organization
        </CardTitle>
        <p className="text-sm text-fg-muted -mt-1">
          Your organization appears in audit trails and member listings. Only owners and admins can
          rename it.
        </p>

        <div className="mt-4 grid gap-3 max-w-sm">
          <Field label="Organization name">
            <Input name="name" required placeholder="Acme Inc" />
          </Field>
        </div>

        {state.error ? <ErrorBlock message={state.error} /> : null}
        {state.ok ? <SuccessBlock message={state.ok} /> : null}

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>
    </form>
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
