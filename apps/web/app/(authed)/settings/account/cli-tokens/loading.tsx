import { Skeleton } from '@/components/ui/skeleton';

export default function CliTokensLoading() {
  return (
    <div className="space-y-5 max-w-2xl">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-3 w-80" />
      <div className="rounded-xl border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 max-w-xs" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full shrink-0" />
            <Skeleton className="h-5 w-16 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
