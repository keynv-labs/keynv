'use client';

import { logoutAction, switchOrgAction } from '@/app/(authed)/actions';
import { Logomark } from '@/components/brand/logomark';
import { CreateOrgDialog } from '@/components/layout/create-org-dialog';
import { CsrfField } from '@/components/security/csrf-field';
import { cn } from '@/lib/cn';
import {
  Activity,
  Building2,
  Check,
  ChevronDown,
  FolderKanban,
  Inbox,
  LogOut,
  Plus,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentType, useState } from 'react';

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
      title: 'Workspace',
      items: [
        {
          href: '/dashboard',
          label: 'Activity',
          icon: Activity,
          shortcut: 'g h',
          match: (p) => p === '/dashboard',
        },
        {
          href: '/projects',
          label: 'Projects',
          icon: FolderKanban,
          shortcut: 'g p',
          match: (p) => p === '/projects' || p.startsWith('/projects/'),
        },
        {
          href: '/inbox',
          label: 'Inbox',
          icon: Inbox,
          shortcut: 'g i',
          match: (p) => p === '/inbox',
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
      title: 'Account',
      items: [
        {
          href: '/settings/org',
          label: 'Organization',
          icon: Building2,
          match: (p) => p.startsWith('/settings/org'),
        },
        {
          href: '/settings/account',
          label: 'Settings',
          icon: Settings,
          shortcut: 'g s',
          match: (p) => p.startsWith('/settings/account'),
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
  orgId: string;
  activeOrgId: string;
  activeOrgName: string;
  orgs: Array<{ id: string; name: string }>;
  /** Called after a nav link click — used by the mobile drawer to close itself. */
  onNavigate?: () => void;
}

const NOOP = () => {};

export function SidebarContent({
  email,
  role,
  activeOrgId,
  activeOrgName,
  orgs,
  onNavigate,
}: SidebarContentProps) {
  const pathname = usePathname() ?? '';
  const initials = email.slice(0, 2).toUpperCase();
  const handleNavigate = onNavigate ?? NOOP;
  const navGroups = buildGroups(role);
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const orgCount = orgs.length;

  return (
    <div className="flex h-full flex-col">
      <div className="h-14 px-4 flex items-center border-b border-border shrink-0">
        <Link href="/dashboard" onClick={handleNavigate} className="flex items-center">
          <Logomark size={22} />
        </Link>
      </div>

      <nav className="flex-1 px-2.5 py-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-5">
            <div className="px-2 mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
              {group.title}
            </div>
            <ul className="flex flex-col gap-px">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={handleNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5',
                        'text-sm transition-colors duration-fast ease-snap',
                        active
                          ? 'bg-bg-elevated-hover text-fg'
                          : 'text-fg-muted hover:bg-bg-elevated-hover hover:text-fg',
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute -left-2.5 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-accent"
                        />
                      ) : null}
                      <Icon size={15} strokeWidth={2} className="shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut ? (
                        <kbd className="hidden md:group-hover:inline-flex font-mono text-[10px] tabular text-fg-subtle">
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

      {/* Org switcher */}
      <div className="mx-3 mb-3">
        <button
          type="button"
          onClick={() => setOrgSwitcherOpen(!orgSwitcherOpen)}
          aria-expanded={orgSwitcherOpen}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-xs transition-colors duration-fast ease-snap',
            'border-border bg-bg-inset/50 hover:border-border-strong hover:bg-bg-elevated-hover cursor-pointer',
          )}
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-elevated text-fg-muted">
            <Building2 size={15} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-fg-subtle">
              Active org
            </div>
            <div className="text-fg leading-tight truncate mt-0.5">{activeOrgName}</div>
          </div>
          <ChevronDown
            size={12}
            strokeWidth={2}
            className={cn(
              'shrink-0 text-fg-subtle transition-transform duration-fast ease-snap',
              orgSwitcherOpen ? 'rotate-180' : '',
            )}
          />
        </button>

        {orgSwitcherOpen ? (
          <div className="mt-2 rounded-xl border border-border-strong bg-bg-overlay shadow-[0_20px_50px_-24px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="border-b border-border px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
                    Organizations
                  </div>
                  <div className="mt-0.5 text-xs text-fg-muted">
                    {orgCount} workspace{orgCount === 1 ? '' : 's'} connected
                  </div>
                </div>
                <Link
                  href="/settings/org"
                  onClick={handleNavigate}
                  className="rounded-md px-2 py-1 text-[11px] text-fg-muted hover:bg-bg-elevated-hover hover:text-fg"
                >
                  Manage
                </Link>
              </div>
            </div>
            {orgs.map((o) => {
              const isActive = o.id === activeOrgId;
              return (
                <form key={o.id} action={switchOrgAction.bind(null, o.id)}>
                  <CsrfField />
                  <button
                    type="submit"
                    disabled={isActive}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors duration-fast ease-snap disabled:cursor-default',
                      isActive
                        ? 'bg-accent-soft text-accent'
                        : 'text-fg-muted hover:bg-bg-elevated-hover hover:text-fg',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-[10px]',
                        isActive
                          ? 'border-accent/30 bg-accent-soft text-accent'
                          : 'border-border bg-bg-inset text-fg-subtle',
                      )}
                    >
                      {o.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">{o.name}</span>
                    {isActive ? <Check size={13} strokeWidth={2} /> : null}
                  </button>
                </form>
              );
            })}
            <div className="border-t border-border">
              <CreateOrgDialog>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-left text-fg-muted hover:bg-bg-elevated-hover hover:text-fg transition-colors duration-fast ease-snap"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border-strong text-fg-subtle">
                    <Plus size={13} strokeWidth={2} />
                  </span>
                  <span className="flex-1">Create new org</span>
                </button>
              </CreateOrgDialog>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border px-3 py-3 flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-strong bg-bg-inset font-mono text-[11px] font-semibold text-fg"
        >
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="truncate text-xs text-fg" title={email}>
            {email}
          </div>
          <div className="text-[10px] text-fg-subtle font-mono uppercase tracking-[0.14em]">
            {role}
          </div>
        </div>
        <form action={logoutAction}>
          <CsrfField />
          <button
            type="submit"
            aria-label="Sign out"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:bg-bg-elevated-hover hover:text-fg transition-colors duration-fast ease-snap"
          >
            <LogOut size={13} strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarContentProps) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-bg-elevated sticky top-0 h-screen self-start">
      <SidebarContent {...props} />
    </aside>
  );
}
