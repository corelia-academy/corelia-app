import { ListRowsSkeleton } from "@/components/loading/RouteSkeleton";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { Skeleton } from "@/components/ui/skeleton";
import { skeletonRevealClass } from "@/components/loading/skeletonReveal";

/** Instructor course list placeholder: page loading state and route fallback. */
export function InstructorCoursesSkeleton() {
  return (
    <PageContainer className={skeletonRevealClass()}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[5.75rem] rounded-2xl" />
        ))}
      </div>
      <ListRowsSkeleton rows={6} className="mt-6 rounded-2xl border border-border-subtle px-4" />
    </PageContainer>
  );
}
