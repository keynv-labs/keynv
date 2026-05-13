import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectSettingsLoading() {
  return (
    <div className="space-y-8 max-w-3xl">
      <section className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {[0, 1].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </section>
      <div className="rounded-xl border border-border bg-bg-elevated p-5 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
