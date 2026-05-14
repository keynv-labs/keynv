'use client';

import { logoutAction } from '@/app/(authed)/actions';
import { cn } from '@/lib/cn';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import {
  Activity,
  FolderKanban,
  Inbox,
  LogOut,
  Plus,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { GPrefixHint } from './g-prefix-hint';
import { Kbd, KbdGroup } from './kbd';
import { PaletteItem } from './palette-item';
import { useCommandPalette } from './use-command-palette';

export function AppPalette() {
  const router = useRouter();

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
  );

  const { open, setOpen, pendingPrefix } = useCommandPalette(navigate);

  const closeAndSignOut = useCallback(async () => {
    setOpen(false);
    await logoutAction();
  }, [setOpen]);

  return (
    <>
      <RadixDialog.Root open={open} onOpenChange={setOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay
            className={cn(
              'fixed inset-0 z-40 bg-black/70',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=open]:fade-in data-[state=closed]:fade-out duration-fast',
            )}
          />
          <RadixDialog.Content
            className={cn(
              'fixed left-1/2 top-[20%] z-50 -translate-x-1/2',
              'w-[92vw] max-w-xl rounded-xl border border-border-strong bg-bg-overlay',
              'shadow-2xl outline-none overflow-hidden',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=open]:fade-in data-[state=closed]:fade-out',
              'data-[state=open]:zoom-in-[0.98] duration-base',
            )}
          >
            <RadixDialog.Title className="sr-only">Command palette</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">
              Search projects, navigate, and run actions.
            </RadixDialog.Description>

            <Command label="Command palette" loop>
              <div className="flex items-center gap-2.5 px-3.5 border-b border-border">
                <Search size={14} strokeWidth={2} className="text-fg-subtle shrink-0" />
                <Command.Input
                  placeholder="Search…"
                  className="h-12 w-full text-sm text-fg placeholder:text-fg-subtle"
                />
              </div>

              <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
                <Command.Empty className="py-8 text-center text-sm text-fg-muted">
                  No results.
                </Command.Empty>

                <Command.Group heading="Go to">
                  <PaletteItem
                    icon={<Activity size={14} strokeWidth={2} />}
                    label="Activity"
                    keywords={['activity', 'home', 'dashboard', 'feed']}
                    hint="g h"
                    onSelect={() => { setOpen(false); router.push('/dashboard'); }}
                  />
                  <PaletteItem
                    icon={<FolderKanban size={14} strokeWidth={2} />}
                    label="Projects"
                    keywords={['projects', 'list', 'all']}
                    hint="g p"
                    onSelect={() => { setOpen(false); router.push('/projects'); }}
                  />
                  <PaletteItem
                    icon={<Inbox size={14} strokeWidth={2} />}
                    label="Inbox"
                    keywords={['inbox', 'approvals', 'pending', 'queue', 'review']}
                    hint="g i"
                    onSelect={() => { setOpen(false); router.push('/inbox'); }}
                  />
                  <PaletteItem
                    icon={<ScrollText size={14} strokeWidth={2} />}
                    label="Audit log"
                    keywords={['audit', 'log', 'history', 'events']}
                    hint="g a"
                    onSelect={() => { setOpen(false); router.push('/audit'); }}
                  />
                  <PaletteItem
                    icon={<Settings size={14} strokeWidth={2} />}
                    label="Account settings"
                    keywords={['settings', 'account', 'profile', 'password']}
                    hint="g s"
                    onSelect={() => { setOpen(false); router.push('/settings/account'); }}
                  />
                  <PaletteItem
                    icon={<Users size={14} strokeWidth={2} />}
                    label="Org users"
                    keywords={['admin', 'users', 'members', 'invite']}
                    hint="g u"
                    onSelect={() => { setOpen(false); router.push('/admin/users'); }}
                  />
                </Command.Group>

                <Command.Group heading="Actions">
                  <PaletteItem
                    icon={<Plus size={14} strokeWidth={2} />}
                    label="New project"
                    keywords={['new', 'create', 'project']}
                    onSelect={() => { setOpen(false); router.push('/projects/new'); }}
                  />
                  <PaletteItem
                    icon={<ShieldCheck size={14} strokeWidth={2} />}
                    label="Verify audit chain"
                    keywords={['verify', 'audit', 'chain', 'integrity', 'tamper']}
                    onSelect={() => { setOpen(false); router.push('/audit'); }}
                  />
                  <PaletteItem
                    icon={<LogOut size={14} strokeWidth={2} />}
                    label="Sign out"
                    onSelect={closeAndSignOut}
                  />
                </Command.Group>
              </Command.List>

              <div className="flex items-center gap-3 px-3.5 py-2 border-t border-border bg-bg/40 text-[11px] text-fg-subtle">
                <KbdGroup>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <span>navigate</span>
                </KbdGroup>
                <KbdGroup>
                  <Kbd>↵</Kbd>
                  <span>select</span>
                </KbdGroup>
                <KbdGroup>
                  <Kbd>esc</Kbd>
                  <span>close</span>
                </KbdGroup>
              </div>
            </Command>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      {pendingPrefix === 'g' ? <GPrefixHint /> : null}
    </>
  );
}
