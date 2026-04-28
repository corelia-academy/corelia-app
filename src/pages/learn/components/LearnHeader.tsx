import { Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft } from "lucide-react";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function LearnHeader({
  courseId,
  courseTitle,
  lessonTitle,
  lessonIndex,
  lessonTotal,
  progressPercent,
  completedCount,
  nextLessonTitle,
  translate,
}: {
  courseId: string;
  courseTitle: string;
  lessonTitle: string | null;
  lessonIndex: number | null;
  lessonTotal: number;
  progressPercent: number;
  completedCount: number;
  nextLessonTitle: string | null;
  translate: TranslateFn;
}) {
  return (
    <>
      <Link
        to={`/courses/${courseId}`}
        className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:hidden"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {translate("detail.learn.backToCourse")}
      </Link>

      <Breadcrumb className="mb-3 hidden sm:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/courses">{translate("catalog.title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to={`/courses/${courseId}`}>{courseTitle}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {lessonTitle ?? translate("detail.learn.breadcrumbLearn")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <section className="mb-6 rounded-2xl border border-border-subtle bg-linear-to-br from-card via-primary-container/25 to-card p-5 shadow-elevation-2 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              {translate("detail.learn.pageEyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {courseTitle}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lessonIndex != null
                ? translate("detail.learn.lessonPosition", {
                    index: lessonIndex + 1,
                    total: lessonTotal,
                  })
                : translate("detail.learn.selectLessonToStart")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border-subtle bg-card/85 px-4 py-3 shadow-card">
              <p className="text-xs text-muted-foreground">
                {translate("detail.learn.stats.progress")}
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {progressPercent}%
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-card/85 px-4 py-3 shadow-card">
              <p className="text-xs text-muted-foreground">
                {translate("detail.learn.stats.completedLessons")}
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {completedCount}/{lessonTotal}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-card/85 px-4 py-3 shadow-card">
              <p className="text-xs text-muted-foreground">
                {translate("detail.learn.stats.nextUp")}
              </p>
              <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">
                {nextLessonTitle ?? translate("detail.learn.completedPath")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

