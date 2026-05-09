import type { HTMLAttributes, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      {...rest}
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-base font-semibold mb-3 ${className}`}>{children}</h2>;
}
