'use client';

import { cn } from '@/lib/cn';
import * as RadixDialog from '@radix-ui/react-dialog';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

const sideStyles: Record<'left' | 'right', string> = {
  left: 'left-0 top-0 h-full data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left border-r border-border',
  right:
    'right-0 top-0 h-full data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right border-l border-border',
};

interface SheetContentProps extends ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  side?: 'left' | 'right';
  children: ReactNode;
}

export function SheetContent({ className, side = 'left', children, ...rest }: SheetContentProps) {
  return (
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
          'fixed z-50 flex flex-col bg-bg-elevated outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out duration-base ease-snap',
          sideStyles[side],
          className,
        )}
        {...rest}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
