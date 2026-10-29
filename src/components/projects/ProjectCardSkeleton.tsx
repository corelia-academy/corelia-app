import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCardSkeleton() {
  return (
    <div className="flex h-full min-h-60 flex-col rounded-lg border border-border bg-surface-base p-4 shadow-card">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-5 w-12" />
      </div>

      <div className="mt-6 min-h-[60px] space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-10 rounded-full" />
        <Skeleton className="h-5 w-11 rounded-full" />
        <Skeleton className="h-5 w-9 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>

      <div className="mt-auto flex min-w-0 items-center justify-between gap-3 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-4 w-5" />
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-4">
            <Skeleton className="size-5" />
            <Skeleton className="size-5" />
            <Skeleton className="size-5" />
          </div>
          <Skeleton className="h-5 w-px" />
          <Skeleton className="size-5" />
        </div>
      </div>
    </div>
  );
}

