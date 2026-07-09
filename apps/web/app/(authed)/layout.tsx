import { AppPalette } from "@/components/command-palette/app-palette";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { CsrfProvider } from "@/components/security/csrf-field";
import { SkipLink } from "@/components/ui/skip-link";
import { api } from "@/lib/api";
import { createCsrfToken } from "@/lib/csrf";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

interface OrgInfo {
  id: string;
  name: string;
}

interface WhoamiResponse {
  orgs?: OrgInfo[];
  org_name?: string;
  org_role?: string;
}

export default async function AuthedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch org info for the sidebar switcher.
  let orgs: OrgInfo[] = [];
  let activeOrgName = session.org_id;
  let activeOrgRole = session.org_role;
  try {
    const data = await api<WhoamiResponse>("/v1/whoami");
    orgs = data.orgs ?? [];
    activeOrgName = data.org_name ?? session.org_id;
    activeOrgRole = data.org_role ?? session.org_role;
  } catch {
    orgs = [{ id: session.org_id, name: session.org_id }];
  }

  const activeOrgId = session.active_org_id || session.org_id;
  const csrfToken = createCsrfToken();

  return (
    <CsrfProvider token={csrfToken}>
      <div className="flex max-w-[1400px] mx-auto min-h-screen">
        <SkipLink />
        <Sidebar
          email={session.email}
          role={activeOrgRole}
          orgId={session.org_id}
          activeOrgId={activeOrgId}
          activeOrgName={activeOrgName}
          orgs={orgs}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          <MobileTopBar
            email={session.email}
            role={activeOrgRole}
            orgId={session.org_id}
            activeOrgId={activeOrgId}
            activeOrgName={activeOrgName}
            orgs={orgs}
          />
          <main id="main" className="flex-1 min-w-0">
            <div className="mx-auto px-4 py-7 md:px-8 md:py-10">{children}</div>
          </main>
        </div>
        <AppPalette />
      </div>
    </CsrfProvider>
  );
}
