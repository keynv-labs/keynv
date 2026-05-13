import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectAuditLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-full" />
      <div className="space-y-4">
        {[0, 1].map((g) => (
          <div key={g} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                  <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                  <Skeleton className="h-4 flex-1 max-w-md" />
                  <Skeleton className="h-3 w-12 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
