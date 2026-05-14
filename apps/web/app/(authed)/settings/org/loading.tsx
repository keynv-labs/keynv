import { Skeleton } from '@/components/ui/skeleton';

export default function OrgSettingsLoading() {
  return (
    <div className="space-y-5 max-w-2xl">
      <Skeleton className="h-10 w-48" />
      <div className="rounded-xl border border-border bg-bg-elevated p-5 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}
