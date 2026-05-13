import { Skeleton } from '@/components/ui/skeleton';

export default function SecretsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <Skeleton className="h-4 w-48 font-mono" />
            <Skeleton className="h-5 w-16" />
            <div className="flex-1" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
