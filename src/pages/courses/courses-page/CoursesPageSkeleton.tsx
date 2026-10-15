import { Skeleton } from "@/components/ui/skeleton";
import { skeletonRevealClass } from "@/components/loading/skeletonReveal";
import { cn } from "@/lib/utils";

/** Courses catalog placeholder: page loading state, route fallback and bootstrap content. */
export function CoursesPageSkeleton() {
  return (
    <div
      className={cn("course-catalog-page container-app pb-8 pt-6 sm:py-8", skeletonRevealClass())}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      <main className="mx-auto w-full max-w-[1072px]">
        <header className="mb-6">
          <Skeleton className="h-8 w-64 max-w-[80%] rounded-md" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full rounded" />
        </header>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-[3fr_1fr_1fr_1fr] xl:items-center xl:gap-2">
          <Skeleton className="h-10 w-full md:col-span-3 xl:col-span-1" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="min-w-0">
              <Skeleton className="mb-2 h-4 w-20 rounded xl:hidden" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="mobile-bleed-grid mt-6 grid grid-cols-[minmax(0,335px)] justify-center gap-6 sm:grid-cols-[repeat(2,minmax(0,335px))] lg:grid-cols-[repeat(3,minmax(0,335px))]">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4 rounded" />
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
                <Skeleton className="h-6 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
