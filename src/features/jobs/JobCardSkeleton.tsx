import { Skeleton } from "@/components/ui/skeleton";

export function JobCardSkeleton() {
  return (
    <div aria-hidden className="flex h-full flex-col gap-6 rounded-md border border-border bg-surface-base p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-[22px] w-3/4" />
          <Skeleton className="h-[15px] w-1/2" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-[18px] w-20 rounded-full" />
          <Skeleton className="h-[18px] w-16 rounded-full" />
          <Skeleton className="h-[18px] w-6 rounded-sm" />
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3">
        <Skeleton className="h-[18px] w-14 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="ml-auto size-5 shrink-0" />
      </div>
    </div>
  );
}
