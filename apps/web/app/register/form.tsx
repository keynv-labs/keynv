'use client';

import { Button } from '@/components/ui/button';
import { ErrorBlock } from '@/components/ui/error-block';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { useActionState, useState } from 'react';
import { type RegisterState, registerAction } from './actions';

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAction, {});
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="next" value={next} />

      <Field label="Work email">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          placeholder="alice@team.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
        />
      </Field>

      <Field label="Password">
        <PasswordInput
          name="password"
          autoComplete="new-password"
          required
          placeholder="At least 12 characters"
          minLength={12}
          maxLength={256}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrength password={password} userInputs={[email, orgName]} />
      </Field>

      {state.error ? <ErrorBlock message={state.error} /> : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-[11px] text-fg-subtle text-center pt-1 leading-relaxed">
        By signing up you agree to keynv being in public beta — no usage limits today, paid tiers
        announced before any charge.
      </p>
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
