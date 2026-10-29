import { Skeleton } from "@/components/ui/skeleton";
import { skeletonRevealClass } from "@/components/loading/skeletonReveal";
import { cn } from "@/lib/utils";
import { HomeCourseCardSkeletonRow } from "./components/HomeCourseCardSkeleton";

function SectionSkeleton() {
  return (
    <section className="mobile-bleed-surface px-5 sm:px-0">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Skeleton className="h-6 w-48 rounded-md" />
      </div>
      <HomeCourseCardSkeletonRow />
    </section>
  );
}

/**
 * Signed-in Home placeholder in the page's own grid (header, XP sidebar, course rows), so the
 * bootstrap screen and route fallback hand over to Home's loading state without a layout swap.
 */
export function HomePageSkeleton() {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 max-w-7xl px-4 pb-6 pt-0 sm:px-6 sm:py-8 lg:px-8xl lg:py-7xl @container",
        skeletonRevealClass(),
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_280px] @max-[807px]:grid-cols-1!">
        <div className="min-w-0 md:col-start-1 md:row-start-1 @max-[807px]:col-auto!">
          <section className="mobile-bleed-surface px-5 pt-5 pb-4 sm:px-0 sm:py-0">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-4 w-full max-w-md rounded" />
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-4 md:col-start-2 md:row-start-1 md:row-span-2 md:self-start @max-[807px]:col-auto! @max-[807px]:row-start-auto! @max-[807px]:row-span-1! @min-[504px]:@max-[807px]:grid @min-[504px]:@max-[807px]:grid-cols-2! @min-[504px]:@max-[807px]:items-start! @min-[504px]:@max-[807px]:gap-4! @min-[504px]:@max-[807px]:space-y-0!">
          <Skeleton className="h-[306px] w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </aside>

        <main className="min-w-0 space-y-6 md:col-start-1 md:row-start-2 @max-[807px]:col-auto! @max-[807px]:row-start-auto!">
          <SectionSkeleton />
          <SectionSkeleton />
        </main>
      </div>
    </div>
  );
}
