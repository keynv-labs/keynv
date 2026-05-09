import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppPalette } from '@/components/command-palette/app-palette';
import { Sidebar } from '@/components/layout/sidebar';
import { getSession } from '@/lib/session';

export default async function AuthedLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <Sidebar email={session.email} role={session.org_role} />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
      <AppPalette />
    </div>
  );
}
