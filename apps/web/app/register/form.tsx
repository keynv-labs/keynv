'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionState } from 'react';
import { type RegisterState, registerAction } from './actions';

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAction, {});

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="next" value={next} />

      <Field label="Work email">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="alice@team.com"
        />
      </Field>

      <Field label="Organization name">
        <Input
          type="text"
          name="org_name"
          autoComplete="organization"
          required
          placeholder="Acme Inc"
          maxLength={64}
        />
      </Field>

      <Field label="Password">
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="At least 12 characters"
          minLength={12}
          maxLength={256}
        />
      </Field>

      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full mt-1">
        {pending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-[11px] text-fg-subtle text-center pt-1">
        By signing up you agree to keynv being in public beta — no usage limits today, paid tiers
        announced before any charge.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
