import { Skeleton } from '@/components/ui/skeleton';

export default function ApprovalsLoading() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-4 py-4 flex items-center gap-4">
            <Skeleton className="h-5 w-16 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
