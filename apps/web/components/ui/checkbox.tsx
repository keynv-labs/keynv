'use client';

import { cn } from '@/lib/cn';
import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

export function Checkbox({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixCheckbox.Root>) {
  return (
    <RadixCheckbox.Root
      className={cn(
        'h-4 w-4 shrink-0 rounded border border-border bg-bg-inset',
        'transition-colors duration-fast ease-snap',
        'hover:border-border-strong',
        'focus:outline-none focus:border-border-bright focus:bg-bg',
        'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      <RadixCheckbox.Indicator className="flex items-center justify-center">
        <Check size={10} strokeWidth={3} className="text-bg" />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
