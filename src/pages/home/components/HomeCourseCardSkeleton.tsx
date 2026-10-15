import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder sized like the Home course cards (continue learning / recommendations). */
export function HomeCourseCardSkeletonRow({ count = 2 }: { count?: number }) {
  return (
    <div className="mt-4 flex flex-wrap items-start gap-6" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="min-w-[240px] max-w-none flex-[1_1_100%] sm:max-w-[335px] sm:flex-[1_1_240px] @min-[504px]:@max-[807px]:flex-[1_1_240px]!"
        >
          <Skeleton className="aspect-video w-full rounded-lg" />
          <div className="flex flex-col gap-4 p-4">
            <div className="flex h-[50px] flex-col gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
