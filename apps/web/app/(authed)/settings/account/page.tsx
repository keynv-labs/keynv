import { Badge } from '@/components/ui/badge';
import { getSession } from '@/lib/session';
import { CheckCircle2 } from 'lucide-react';
import { redirect } from 'next/navigation';
import { ChangePasswordForm } from './password-form';

export default async function AccountProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="space-y-5 max-w-2xl">
      <section className="rounded-lg border border-border bg-bg-elevated p-5 space-y-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Profile
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-elevated-hover text-sm font-semibold text-fg"
            >
              {session.email.slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-fg">{session.email}</div>
              <div className="text-[11px] text-fg-subtle mt-0.5 font-mono">{session.user_id}</div>
            </div>
            <Badge tone={session.org_role === 'owner' ? 'warn' : 'success'}>
              {session.org_role}
            </Badge>
          </div>
        </div>

        <div className="border-t border-border pt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <Field label="Email">
            <span className="text-fg">{session.email}</span>
            <span className="block text-[11px] text-fg-subtle mt-0.5">
              Email change requires admin support today.
            </span>
          </Field>
          <Field label="Org role">
            <span className="capitalize text-fg">{session.org_role}</span>
            <span className="block text-[11px] text-fg-subtle mt-0.5">
              Set by org admins. Affects what you can read and write.
            </span>
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-bg-elevated p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          Password
        </div>
        <p className="text-sm text-fg-muted mt-2">
          Changing your password signs you out from any other device with an active session.
          Argon2id-hashed at rest.
        </p>
        <ChangePasswordForm />
      </section>

      <section className="rounded-lg border border-border bg-bg-elevated p-5 opacity-60">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          MFA
          <span className="rounded-sm border border-border px-1.5 py-0.5 normal-case font-medium tracking-normal text-[10px]">
            Phase 5+
          </span>
        </div>
        <p className="text-sm text-fg-muted mt-2 flex items-start gap-2">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-fg-subtle" />
          TOTP enrollment ships in Phase 5 hardening. For now your account is protected by the owner
          password and rate-limited login.
        </p>
      </section>
    </div>
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
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
