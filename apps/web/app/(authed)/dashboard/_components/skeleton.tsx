import { Skeleton } from '@/components/ui/skeleton';

export function ActivitySkeleton() {
  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-bg-elevated p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16 mt-3" />
          </div>
        ))}
      </section>
      <section>
        <Skeleton className="h-3 w-32 mb-3" />
        <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-4 flex-1 max-w-md" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
