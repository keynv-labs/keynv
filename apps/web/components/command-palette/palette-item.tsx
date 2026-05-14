import { Command } from 'cmdk';
import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  label: string;
  keywords?: string[];
  hint?: string;
  onSelect: () => void | Promise<void>;
}

export function PaletteItem({ icon, label, keywords, hint, onSelect }: Props) {
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
