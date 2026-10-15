import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function LearnMissingCourseIdState({
  translate,
}: {
  translate: TranslateFn;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 shadow-card">
        <p className="text-sm font-medium text-destructive">
          {translate("detail.missingCourseId")}
        </p>
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center gap-2 text-sm text-foreground-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />{" "}
          {translate("detail.learn.backToCourses")}
        </Link>
      </div>
    </div>
  );
}

/** Placeholder for the lesson player area while the resume redirect resolves. */
export function LessonPlayerSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-6" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <Skeleton className="aspect-video w-full max-w-5xl rounded-2xl" />
      <Skeleton className="h-7 w-2/3 max-w-xl rounded-lg" />
      <Skeleton className="h-4 w-full max-w-3xl" />
      <Skeleton className="h-4 w-5/6 max-w-3xl" />
    </div>
  );
}

export function LearnErrorState({
  translate,
  message,
}: {
  translate: TranslateFn;
  message: string;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 shadow-card">
        <p className="text-sm font-medium text-destructive">{message}</p>
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center gap-2 text-sm text-foreground-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />{" "}
          {translate("detail.learn.backToCourses")}
        </Link>
      </div>
    </div>
  );
}
