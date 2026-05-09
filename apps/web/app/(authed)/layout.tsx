import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppPalette } from '@/components/command-palette/app-palette';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';
import { Sidebar } from '@/components/layout/sidebar';
import { getSession } from '@/lib/session';

export default async function AuthedLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <Sidebar email={session.email} role={session.org_role} />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar email={session.email} role={session.org_role} />
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
      <AppPalette />
    </div>
  );
}
