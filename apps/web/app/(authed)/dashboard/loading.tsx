import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-7">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-3 w-32" />
        <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 max-w-lg" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
