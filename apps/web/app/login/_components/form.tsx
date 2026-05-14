'use client';

import { Button } from '@/components/ui/button';
import { ErrorBlock } from '@/components/ui/error-block';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useActionState } from 'react';
import { type LoginState, loginAction } from '../_actions/actions';

/**
 * MVP convenience: when running `next dev` we pre-fill the bootstrap
 * defaults so the login round-trip is one keystroke (`Enter`). NODE_ENV
 * is inlined at build time, so `next build` (Coolify, production) drops
 * the entire branch to `null` — the autofill never ships.
 *
 * Change the values here if you bootstrap with different credentials.
 */
const DEV_AUTOFILL =
  process.env.NODE_ENV === 'development'
    ? { email: 'you@example.com', password: 'bir-uzun-12-plus-parola' }
    : null;

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="next" value={next} />

      <Field label="Email">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="alice@team.com"
          defaultValue={DEV_AUTOFILL?.email}
        />
      </Field>

      <Field label="Password">
        <PasswordInput
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••"
          defaultValue={DEV_AUTOFILL?.password}
        />
      </Field>

      {state.error ? <ErrorBlock message={state.error} /> : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      {DEV_AUTOFILL ? (
        <p className="text-[11px] text-fg-subtle text-center pt-1 font-mono uppercase tracking-[0.14em]">
          dev autofill on · press <kbd className="text-fg-muted normal-case">Enter</kbd>
        </p>
      ) : null}
    </form>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}
