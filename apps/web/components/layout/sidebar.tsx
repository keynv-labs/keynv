'use client';

import { FolderKanban, ScrollText, Settings, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { logoutAction } from '@/app/(authed)/actions';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  shortcut?: string;
  match: (pathname: string) => boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function buildGroups(role: string): NavGroup[] {
  const groups: NavGroup[] = [
    {
      title: 'Home',
      items: [
        {
          href: '/projects',
          label: 'Projects',
          icon: FolderKanban,
          shortcut: 'g p',
          match: (p) => p === '/projects' || p.startsWith('/projects/'),
        },
        {
          href: '/audit',
          label: 'Audit log',
          icon: ScrollText,
          shortcut: 'g a',
          match: (p) => p === '/audit',
        },
      ],
    },
    {
      title: 'Workspace',
      items: [
        {
          href: '/settings/account',
          label: 'Account',
          icon: Settings,
          shortcut: 'g s',
          match: (p) => p.startsWith('/settings'),
        },
      ],
    },
  ];

  if (role === 'owner' || role === 'admin') {
    groups.push({
      title: 'Admin',
      items: [
        {
          href: '/admin/users',
          label: 'Users',
          icon: Users,
          shortcut: 'g u',
          match: (p) => p.startsWith('/admin/users'),
        },
      ],
    });
  }

  return groups;
}

interface SidebarContentProps {
  email: string;
  role: string;
  /** Called after a nav link click — used by the mobile drawer to close itself. */
  onNavigate?: () => void;
}

/**
 * The actual sidebar content. Renders a vertical column with a brand
 * block, nav groups, audit chain pill, and user block. No outer wrapper;
 * callers decide how to position it (desktop aside vs. mobile sheet).
 */
const NOOP = () => {};

export function SidebarContent({ email, role, onNavigate }: SidebarContentProps) {
  const pathname = usePathname() ?? '';
  const initials = email.slice(0, 2).toUpperCase();
  const handleNavigate = onNavigate ?? NOOP;
  const navGroups = buildGroups(role);

  return (
    <div className="flex h-full flex-col">
      <div className="h-14 px-4 flex items-center border-b border-border shrink-0">
        <Link
          href={{ pathname: '/projects' }}
          onClick={handleNavigate}
          className="flex items-center gap-2 font-semibold tracking-tight text-fg"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-fg-on-accent text-[11px] font-bold">
            k
          </span>
          <span>keynv</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {group.title}
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={{ pathname: item.href }}
                      onClick={handleNavigate}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-md px-2 py-1.5',
                        'text-sm transition-colors duration-fast ease-snap',
                        active
                          ? 'bg-bg-elevated-hover text-fg'
                          : 'text-fg-muted hover:bg-bg-elevated-hover hover:text-fg',
                      )}
                    >
                      <Icon size={15} strokeWidth={2} className="shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut ? (
                        <kbd className="hidden md:group-hover:inline-flex font-mono text-[10px] text-fg-subtle">
                          {item.shortcut}
                        </kbd>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <Link
        href={{ pathname: '/audit' }}
        onClick={handleNavigate}
        className="mx-3 mb-3 flex items-center gap-2.5 rounded-md border border-border bg-bg px-2.5 py-2 text-xs hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
      >
        <ShieldCheck size={14} className="shrink-0 text-success" />
        <div className="flex-1 min-w-0">
          <div className="text-fg leading-tight">Audit chain</div>
          <div className="text-fg-subtle leading-tight mt-0.5">tamper-evident log</div>
        </div>
      </Link>

      <div className="border-t border-border px-3 py-3 flex items-start gap-2.5">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-elevated-hover text-[11px] font-semibold text-fg"
        >
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="truncate text-xs text-fg" title={email}>
            {email}
          </div>
          <div className="text-[11px] text-fg-subtle capitalize">{role}</div>
        </div>
      </div>
      <form action={logoutAction} className="px-3 pb-3">
        <button
          type="submit"
          className="w-full text-left px-2 py-1.5 rounded-md text-xs text-fg-muted hover:bg-bg-elevated-hover hover:text-fg transition-colors duration-fast ease-snap"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

/**
 * Desktop sidebar — fixed-width column to the left of main content.
 * Hidden below md (mobile uses MobileTopBar + Sheet).
 */
export function Sidebar(props: SidebarContentProps) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-bg-elevated">
      <SidebarContent {...props} />
    </aside>
  );
}
