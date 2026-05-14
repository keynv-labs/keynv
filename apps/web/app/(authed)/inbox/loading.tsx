import { Skeleton } from '@/components/ui/skeleton';

export default function InboxLoading() {
  return (
    <div className="space-y-7">
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-md shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 max-w-md" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
