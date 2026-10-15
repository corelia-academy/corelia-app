import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { LessonPlayerSkeletonBody } from "@/components/loading/RouteSkeleton";
import { skeletonRevealClass } from "@/components/loading/skeletonReveal";
import { cn } from "@/lib/utils";

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
    <div className={cn("h-full", skeletonRevealClass())} role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <LessonPlayerSkeletonBody />
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
