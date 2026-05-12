import { cn } from '@/lib/cn';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', { box: string; type: string }> = {
  sm: { box: 'h-6 w-6 text-base', type: 'text-base' },
  md: { box: 'h-8 w-8 text-xl', type: 'text-xl' },
  lg: { box: 'h-12 w-12 text-3xl', type: 'text-3xl' },
};

const SHADOW: Record<'sm' | 'md' | 'lg', string> = {
  sm: '2px 2px 0 0 var(--color-highlight)',
  md: '3px 3px 0 0 var(--color-highlight)',
  lg: '4px 4px 0 0 var(--color-highlight)',
};

/**
 * Stamped block-letter logomark. Reads as "ink on paper with a
 * highlighter swipe behind it" on every surface — both the dark
 * dashboard (where bg-fg is pale and text-bg is dark) and the
 * newsprint marketing (where the relationship flips). Same visual
 * idea, both themes.
 */
export function Logomark({ size = 'md', className }: Props) {
  const c = SIZE_CLASSES[size];
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center bg-fg text-bg font-display font-medium leading-none relative shrink-0',
        c.box,
        className,
      )}
      style={{ boxShadow: SHADOW[size] }}
    >
      k
    </span>
  );
}
