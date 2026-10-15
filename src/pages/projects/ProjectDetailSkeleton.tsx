import { Skeleton } from "@/components/ui/skeleton";
import { skeletonRevealClass } from "@/components/loading/skeletonReveal";
import { cn } from "@/lib/utils";

/** Project detail placeholder: page loading state, route fallback and bootstrap content. */
export function ProjectDetailSkeleton() {
  return (
    <div
      className={cn("container-app pb-6 pt-4 sm:py-8", skeletonRevealClass())}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="mb-4 h-8 w-40" />
      <Skeleton className="h-72 w-full rounded-lg" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </div>
  );
}
