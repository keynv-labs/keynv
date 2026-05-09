import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  // The (authed) layout already redirects unauthenticated users; here we
  // gate by role. Owner and admin can see the admin surface.
  if (!session) redirect('/login');
  if (session.org_role !== 'owner' && session.org_role !== 'admin') {
    redirect('/projects');
  }
  return <>{children}</>;
}
