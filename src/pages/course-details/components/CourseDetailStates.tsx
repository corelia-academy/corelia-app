import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

export function CourseDetailLoading() {
  const { t } = useTranslation("courses");
  return (
    <div
      className="container-app animate-skeleton-reveal pb-6 pt-0 sm:py-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{String(t("detail.loadingCourse"))}</span>
      <Skeleton className="mobile-bleed-surface h-72 w-full rounded-2xl sm:h-80" />
      <div className="mobile-bleed-grid mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="order-2 min-w-0 space-y-6 lg:order-none">
          <div className="space-y-3 rounded-2xl border border-border-subtle p-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="space-y-2 rounded-2xl border border-border-subtle p-4">
            <Skeleton className="mb-2 h-6 w-40" />
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="order-1 space-y-4 lg:order-none">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function CourseDetailError({ message }: { message?: string | null }) {
  const { t } = useTranslation("courses");
  return (
    <div className="container-app pb-6 pt-0 sm:py-8">
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-5 shadow-sm">
        <p className="text-sm font-medium text-destructive">
          {message ?? String(t("detail.notFound"))}
        </p>
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center gap-2 text-sm text-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="size-4" />{" "}
          {String(t("detail.courseDetail.backToCoursesList"))}
        </Link>
      </div>
    </div>
  );
}
