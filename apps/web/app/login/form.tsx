'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type LoginState, loginAction } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="next" value={next} />

      <Field label="Email">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="alice@team.com"
        />
      </Field>

      <Field label="Password">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••"
        />
      </Field>

      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full mt-1">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
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
