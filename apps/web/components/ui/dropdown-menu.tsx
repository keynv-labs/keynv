'use client';

import { cn } from '@/lib/cn';
import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export const DropdownMenu = RadixMenu.Root;
export const DropdownMenuTrigger = RadixMenu.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-40 min-w-44 rounded-md border border-border-strong bg-bg-overlay p-1',
          'text-sm text-fg shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in data-[state=closed]:fade-out',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
          'duration-fast',
          className,
        )}
        {...rest}
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixMenu.Item> & { children: ReactNode }) {
  return (
    <RadixMenu.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5',
        'text-sm text-fg outline-none',
        'data-[highlighted]:bg-bg-elevated-hover data-[highlighted]:text-fg',
        'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      {children}
    </RadixMenu.Item>
  );
}

export function DropdownMenuSeparator(props: ComponentPropsWithoutRef<typeof RadixMenu.Separator>) {
  return <RadixMenu.Separator className="my-1 h-px bg-border" {...props} />;
}

export function DropdownMenuLabel({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixMenu.Label> & { children: ReactNode }) {
  return (
    <RadixMenu.Label
      className={cn(
        'px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle',
        className,
      )}
      {...rest}
    >
      {children}
    </RadixMenu.Label>
  );
}
