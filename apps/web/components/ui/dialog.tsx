'use client';

import { cn } from '@/lib/cn';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixDialog.Content> & { children: ReactNode }) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out duration-fast" />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md rounded-xl border border-border-strong bg-bg-overlay p-5',
          'shadow-[0_24px_64px_-16px_rgba(0,0,0,0.6),0_1px_0_rgba(255,255,255,0.04)_inset] outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in data-[state=closed]:fade-out',
          'data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.98]',
          'duration-base',
          className,
        )}
        {...rest}
      >
        {children}
        <RadixDialog.Close
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-elevated-hover hover:text-fg transition-colors duration-fast ease-snap"
        >
          <X size={14} strokeWidth={2} />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogTitle({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixDialog.Title> & { children: ReactNode }) {
  return (
    <RadixDialog.Title className={cn('text-base font-semibold text-fg pr-8', className)} {...rest}>
      {children}
    </RadixDialog.Title>
  );
}

export function DialogDescription({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixDialog.Description> & { children: ReactNode }) {
  return (
    <RadixDialog.Description className={cn('mt-1 text-sm text-fg-muted', className)} {...rest}>
      {children}
    </RadixDialog.Description>
  );
}

export function DialogFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('mt-5 flex items-center justify-end gap-2', className)}>{children}</div>
  );
}
