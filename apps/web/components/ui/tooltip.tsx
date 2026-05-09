'use client';

import { cn } from '@/lib/cn';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

interface Props {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 250,
}: Props) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={6}
            className={cn(
              'z-50 max-w-xs rounded-md border border-border-strong bg-bg-overlay px-2 py-1',
              'text-xs text-fg shadow-lg',
              'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
              'data-[state=delayed-open]:fade-in data-[state=closed]:fade-out',
              'duration-fast',
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-bg-overlay" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
