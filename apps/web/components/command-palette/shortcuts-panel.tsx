'use client';

import { cn } from '@/lib/cn';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Kbd, KbdGroup } from './kbd';

interface ShortcutRow {
  keys: string[];
  label: string;
}

const NAV_SHORTCUTS: ShortcutRow[] = [
  { keys: ['g', 'h'], label: 'Go to Activity' },
  { keys: ['g', 'p'], label: 'Go to Projects' },
  { keys: ['g', 'i'], label: 'Go to Inbox' },
  { keys: ['g', 'f'], label: 'Search secrets' },
  { keys: ['g', 'a'], label: 'Go to Audit log' },
  { keys: ['g', 's'], label: 'Go to Settings' },
  { keys: ['g', 'u'], label: 'Go to Org users' },
];

const GENERAL_SHORTCUTS: ShortcutRow[] = [
  { keys: ['Cmd', 'K'], label: 'Open command palette' },
  { keys: ['↑'], label: 'Navigate up (in palette)' },
  { keys: ['↓'], label: 'Navigate down (in palette)' },
  { keys: ['↵'], label: 'Select (in palette)' },
  { keys: ['esc'], label: 'Close palette / cancel' },
  { keys: ['?'], label: 'Show this panel' },
];

function ShortcutRow({ keys, label }: ShortcutRow) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-fg">{label}</span>
      <KbdGroup>
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </KbdGroup>
    </div>
  );
}

interface ShortcutsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsPanel({ open, onOpenChange }: ShortcutsPanelProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
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
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[92vw] max-w-md rounded-xl border border-border-strong bg-bg-overlay',
            'shadow-2xl outline-none overflow-hidden p-0',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in data-[state=closed]:fade-out',
            'data-[state=open]:zoom-in-[0.98] duration-base',
          )}
        >
          <div className="px-5 py-4 border-b border-border">
            <RadixDialog.Title className="text-sm font-semibold">
              Keyboard shortcuts
            </RadixDialog.Title>
            <RadixDialog.Description className="text-xs text-fg-subtle mt-0.5">
              All available shortcuts in keynv
            </RadixDialog.Description>
          </div>

          <div className="px-5 py-3 max-h-[70vh] overflow-y-auto">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-fg-subtle mb-2 mt-1">
              Navigation
            </h3>
            {NAV_SHORTCUTS.map((s) => (
              <ShortcutRow key={s.keys.join('')} {...s} />
            ))}

            <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-fg-subtle mb-2 mt-5">
              General
            </h3>
            {GENERAL_SHORTCUTS.map((s) => (
              <ShortcutRow key={s.keys.join('')} {...s} />
            ))}
          </div>

          <div className="px-5 py-3 border-t border-border">
            <RadixDialog.Close className="w-full text-center text-xs text-fg-subtle hover:text-fg transition-colors">
              Close
            </RadixDialog.Close>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
