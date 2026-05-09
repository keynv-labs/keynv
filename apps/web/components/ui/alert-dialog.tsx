'use client';

import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const AlertDialog = RadixAlertDialog.Root;
export const AlertDialogTrigger = RadixAlertDialog.Trigger;
export const AlertDialogCancel = RadixAlertDialog.Cancel;
export const AlertDialogAction = RadixAlertDialog.Action;

export function AlertDialogContent({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixAlertDialog.Content> & { children: ReactNode }) {
  return (
    <RadixAlertDialog.Portal>
      <RadixAlertDialog.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out duration-fast" />
      <RadixAlertDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md rounded-xl border border-border-strong bg-bg-overlay p-5',
          'shadow-2xl outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in data-[state=closed]:fade-out',
          'data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.98]',
          'duration-base',
          className,
        )}
        {...rest}
      >
        {children}
      </RadixAlertDialog.Content>
    </RadixAlertDialog.Portal>
  );
}

export function AlertDialogTitle({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixAlertDialog.Title> & { children: ReactNode }) {
  return (
    <RadixAlertDialog.Title
      className={cn('text-base font-semibold text-fg', className)}
      {...rest}
    >
      {children}
    </RadixAlertDialog.Title>
  );
}

export function AlertDialogDescription({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixAlertDialog.Description> & { children: ReactNode }) {
  return (
    <RadixAlertDialog.Description
      className={cn('mt-1 text-sm text-fg-muted', className)}
      {...rest}
    >
      {children}
    </RadixAlertDialog.Description>
  );
}

export function AlertDialogFooter({
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
