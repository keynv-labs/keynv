import { cn } from '@/lib/cn';

export function ErrorBlock({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      role="alert"
      aria-live="polite"
      className={cn(
        'rounded-md border border-danger-soft-border bg-danger-soft px-3 py-2 text-xs text-danger',
        className,
      )}
    >
      {message}
    </p>
  );
}

export function SuccessBlock({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-md border border-success-soft-border bg-success-soft px-3 py-2 text-xs text-success',
        className,
      )}
    >
      {message}
    </p>
  );
}
