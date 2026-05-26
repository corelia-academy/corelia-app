import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCardSkeleton() {
  return (
    <div className="h-full overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-card">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Skeleton className="h-7 w-24" />
          <div className="flex gap-2">
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
          </div>
        </div>
      </div>
    </div>
  );
}

