'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import {
  FolderKanban,
  LogOut,
  Plus,
  ScrollText,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { logoutAction } from '@/app/(authed)/actions';
import { cn } from '@/lib/cn';

/**
 * App-wide command palette + global keyboard shortcuts.
 *
 * - ⌘K / Ctrl+K opens the palette
 * - g + p / g + a navigates without opening the palette (Linear-style
 *   2-key sequences)
 * - Esc closes the palette
 *
 * Mounted once in the (authed) layout; safe to render on every route.
 */
export function AppPalette() {
  const [open, setOpen] = useState(false);
  const [pendingPrefix, setPendingPrefix] = useState<string | null>(null);
  const router = useRouter();
  const prefixTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeAndGo = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  const closeAndSignOut = useCallback(async () => {
    setOpen(false);
    await logoutAction();
  }, []);

  useEffect(() => {
    function isInTextField(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function handler(e: KeyboardEvent) {
      // ⌘K toggles the palette regardless of focus.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      if (open) return;
      if (isInTextField(e.target)) return;

      // g-prefix: 2-key navigation sequence.
      if (pendingPrefix === 'g') {
        if (e.key === 'p') {
          e.preventDefault();
          router.push('/projects');
        } else if (e.key === 'a') {
          e.preventDefault();
          router.push('/audit');
        }
        setPendingPrefix(null);
        if (prefixTimeoutRef.current) clearTimeout(prefixTimeoutRef.current);
        return;
      }

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setPendingPrefix('g');
        if (prefixTimeoutRef.current) clearTimeout(prefixTimeoutRef.current);
        prefixTimeoutRef.current = setTimeout(() => {
          setPendingPrefix((curr) => (curr === 'g' ? null : curr));
        }, 1500);
      }
    }

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (prefixTimeoutRef.current) clearTimeout(prefixTimeoutRef.current);
    };
  }, [open, pendingPrefix, router]);

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
                    icon={<FolderKanban size={14} strokeWidth={2} />}
                    label="Projects"
                    keywords={['projects', 'home', 'dashboard']}
                    hint="g p"
                    onSelect={() => closeAndGo('/projects')}
                  />
                  <PaletteItem
                    icon={<ScrollText size={14} strokeWidth={2} />}
                    label="Audit log"
                    keywords={['audit', 'log', 'history', 'events']}
                    hint="g a"
                    onSelect={() => closeAndGo('/audit')}
                  />
                </Command.Group>

                <Command.Group heading="Actions">
                  <PaletteItem
                    icon={<Plus size={14} strokeWidth={2} />}
                    label="New project"
                    keywords={['new', 'create', 'project']}
                    onSelect={() => closeAndGo('/projects/new')}
                  />
                  <PaletteItem
                    icon={<ShieldCheck size={14} strokeWidth={2} />}
                    label="Verify audit chain"
                    keywords={['verify', 'audit', 'chain', 'integrity', 'tamper']}
                    onSelect={() => closeAndGo('/audit')}
                  />
                  <PaletteItem
                    icon={<LogOut size={14} strokeWidth={2} />}
                    label="Sign out"
                    keywords={['logout', 'sign', 'exit']}
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

interface PaletteItemProps {
  icon: ReactNode;
  label: string;
  keywords?: string[];
  hint?: string;
  onSelect: () => void | Promise<void>;
}

function PaletteItem({ icon, label, keywords, hint, onSelect }: PaletteItemProps) {
  return (
    <Command.Item
      value={[label, ...(keywords ?? [])].join(' ')}
      onSelect={() => {
        void onSelect();
      }}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg"
    >
      <span className="text-fg-muted shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint ? (
        <kbd className="font-mono text-[11px] tracking-wider text-fg-subtle">{hint}</kbd>
      ) : null}
    </Command.Item>
  );
}

function KbdGroup({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1">{children}</span>;
}

function Kbd({ children, ...rest }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-border bg-bg px-1 font-mono text-[10px] text-fg-muted"
      {...rest}
    >
      {children}
    </kbd>
  );
}

function GPrefixHint() {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 right-4 z-30',
        'rounded-md border border-border-strong bg-bg-overlay px-3 py-2 text-xs text-fg shadow-lg',
        'animate-list-enter',
      )}
    >
      <span className="font-mono text-fg-muted">g</span>
      <span className="mx-1.5 text-fg-subtle">→</span>
      <span className="font-mono text-fg">p</span>
      <span className="text-fg-muted"> projects</span>
      <span className="mx-2 text-fg-subtle">·</span>
      <span className="font-mono text-fg">a</span>
      <span className="text-fg-muted"> audit</span>
    </div>
  );
}
