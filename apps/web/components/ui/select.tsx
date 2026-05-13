'use client';

import { cn } from '@/lib/cn';
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

export function Select({
  className,
  placeholder,
  children,
  ...rootProps
}: ComponentPropsWithoutRef<typeof RadixSelect.Root> & {
  className?: string;
  placeholder?: string;
}) {
  return (
    <RadixSelect.Root {...rootProps}>
      <RadixSelect.Trigger
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border',
          'bg-bg-inset px-3 text-sm text-fg',
          'transition-colors duration-fast ease-snap',
          'hover:border-border-strong',
          'focus:border-border-bright focus:bg-bg focus:outline-none',
          'data-[placeholder]:text-fg-subtle',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder ?? '—'} />
        <RadixSelect.Icon asChild>
          <ChevronDown size={13} strokeWidth={2} className="shrink-0 text-fg-muted" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[var(--radix-select-trigger-width)] rounded-md border border-border-strong',
            'bg-bg-overlay p-1',
            'shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7),0_1px_0_rgba(255,255,255,0.04)_inset]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
            'duration-fast',
          )}
        >
          <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export function SelectItem({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixSelect.Item>) {
  return (
    <RadixSelect.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-7 pr-2',
        'text-sm text-fg outline-none',
        'data-[highlighted]:bg-bg-elevated-hover',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
      {...rest}
    >
      <span className="absolute left-2 flex items-center justify-center">
        <RadixSelect.ItemIndicator>
          <Check size={12} strokeWidth={2.5} className="text-accent" />
        </RadixSelect.ItemIndicator>
      </span>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}

export function SelectSeparator() {
  return <RadixSelect.Separator className="my-1 h-px bg-border" />;
}
