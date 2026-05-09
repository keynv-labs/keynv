import { getSession } from '@/lib/session';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { logoutAction } from './actions';

export default async function AuthedLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 flex flex-col">
        <div className="mb-6">
          <div className="text-xl font-bold tracking-tight">keynv</div>
          <div className="text-xs text-[var(--color-fg-muted)] mt-1">{session.email}</div>
          <div className="text-xs text-[var(--color-fg-muted)]">role: {session.org_role}</div>
        </div>
        <nav className="flex-1 flex flex-col gap-1 text-sm">
          <Link
            href="/projects"
            className="px-3 py-2 rounded-md text-[var(--color-fg)] hover:bg-[var(--color-bg-card-hover)]"
          >
            Projects
          </Link>
          <Link
            href="/audit"
            className="px-3 py-2 rounded-md text-[var(--color-fg)] hover:bg-[var(--color-bg-card-hover)]"
          >
            Audit log
          </Link>
        </nav>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2 rounded-md text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-card-hover)]"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8 max-w-5xl">{children}</main>
    </div>
  );
}
