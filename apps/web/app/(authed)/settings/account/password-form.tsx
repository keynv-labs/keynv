'use client';

import { useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type PasswordState, changePasswordAction } from './actions';

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    changePasswordAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset();
    }
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="mt-4 grid gap-3 max-w-sm">
      <Field label="Current password">
        <Input
          type="password"
          name="current_password"
          required
          autoComplete="current-password"
          placeholder="••••••••••••"
        />
      </Field>

      <Field
        label="New password"
        hint="12+ characters. Argon2id-hashed before it leaves the server."
      >
        <Input
          type="password"
          name="new_password"
          required
          autoComplete="new-password"
          minLength={12}
          placeholder="••••••••••••"
        />
      </Field>

      <Field label="Confirm new password">
        <Input
          type="password"
          name="confirm_password"
          required
          autoComplete="new-password"
          minLength={12}
          placeholder="••••••••••••"
        />
      </Field>

      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-success">{state.ok}</p> : null}

      <div className="flex items-center justify-end pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? 'Updating…' : 'Update password'}
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
