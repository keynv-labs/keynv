import { Badge } from "@/components/ui/badge";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Field } from "./_components/field";
import { ChangePasswordForm } from "./_components/password-form";

export default async function AccountProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-5">
      <Card bezel className="space-y-5">
        <div>
          <CardEyebrow>profile</CardEyebrow>
          <div className="mt-3 flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-strong bg-bg-inset font-mono text-sm font-semibold text-fg"
            >
              {session.email.slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-fg">{session.email}</div>
              <div className="text-[11px] text-fg-subtle mt-0.5 font-mono tabular">
                {session.user_id}
              </div>
            </div>
            <Badge tone={session.org_role === "owner" ? "accent" : "success"}>
              {session.org_role}
            </Badge>
          </div>
        </div>

        <div className="border-t border-border pt-5 grid gap-4 sm:grid-cols-2 text-sm">
          <Field label="email">
            <span className="text-fg">{session.email}</span>
            <span className="block text-[11px] text-fg-subtle mt-1">
              Email change requires admin support today.
            </span>
          </Field>
          <Field label="org role">
            <span className="capitalize text-fg">{session.org_role}</span>
            <span className="block text-[11px] text-fg-subtle mt-1">
              Set by org admins. Affects what you can read and write.
            </span>
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Password
        </CardTitle>
        <p className="text-sm text-fg-muted -mt-1">
          Changing your password signs you out from any other device with an
          active session. Argon2id-hashed at rest.
        </p>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
