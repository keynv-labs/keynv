'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionState } from 'react';
import { type LoginState, loginAction } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-xs text-[var(--color-fg-muted)] block mb-1">Email</span>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="alice@team.com"
        />
      </label>
      <label className="block">
        <span className="text-xs text-[var(--color-fg-muted)] block mb-1">Password</span>
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="•••••••••"
        />
      </label>
      {state.error ? (
        <p className="text-xs text-[var(--color-danger)] mt-1">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
