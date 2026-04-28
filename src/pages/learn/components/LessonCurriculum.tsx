import { Link } from "react-router";
import { CheckCircle2, ChevronDown, List, Lock, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/types/courses";
import type { CourseLesson, CourseSection } from "@/types/courses";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export interface CurriculumGroup {
  section: CourseSection;
  lessons: CourseLesson[];
}

function CurriculumList({
  courseId,
  groups,
  currentLessonId,
  completedIds,
  hasFullCourseAccess,
  translate,
  scrollClassName,
}: {
  courseId: string;
  groups: CurriculumGroup[];
  currentLessonId: string | null;
  completedIds: Set<string>;
  hasFullCourseAccess: boolean;
  translate: TranslateFn;
  scrollClassName?: string;
}) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <List className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {translate("detail.learn.emptyCurriculumTitle")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {translate("detail.learn.emptyCurriculumDescription")}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          render={<Link to={`/courses/${courseId}`} />}
          nativeButton={false}
        >
          {translate("detail.learn.backToCourse")}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(scrollClassName)}>
      {groups.map(({ section, lessons: sectionLessons }) => (
        <div key={section.id}>
          <div className="bg-muted/25 px-4 py-2 text-xs font-medium text-foreground">
            {section.title}
          </div>
          {sectionLessons.map((lesson) => {
            const done = completedIds.has(lesson.id);
            const active = currentLessonId === lesson.id;
            const locked = !hasFullCourseAccess && !lesson.is_preview_free;
            return (
              <div
                key={lesson.id}
                className={cn(
                  "border-t border-border-subtle px-4 py-3 transition-colors",
                  active && "bg-primary-container/85",
                  !locked && "hover:bg-muted/40",
                  locked && "opacity-75",
                )}
              >
                {locked ? (
                  <div className="flex items-start gap-3">
                    <Lock
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {lesson.title}
                    </span>
                    <span className="shrink-0 text-xs text-warning">
                      {translate("detail.learn.lessonLockedBadge")}
                    </span>
                  </div>
                ) : (
                  <Link
                    to={`/learn/${courseId}/lesson/${lesson.id}`}
                    className="flex items-start gap-3 sm:items-center"
                  >
                    {done ? (
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-success sm:mt-0"
                        aria-hidden
                      />
                    ) : (
                      <PlayCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block line-clamp-2 text-sm leading-5 sm:line-clamp-1",
                          active
                            ? "font-medium text-on-primary-container"
                            : "text-foreground",
                        )}
                      >
                        {lesson.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground sm:hidden">
                        {formatDuration(lesson.duration_seconds)}
                      </span>
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {formatDuration(lesson.duration_seconds)}
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function LessonCurriculum({
  courseId,
  groups,
  visibleSectionCount,
  visibleLessonsCount,
  sortedLessonsCount,
  currentLessonTitle,
  currentLessonId,
  progressPercent,
  completedIds,
  hasFullCourseAccess,
  translate,
}: {
  courseId: string;
  groups: CurriculumGroup[];
  visibleSectionCount: number;
  visibleLessonsCount: number;
  sortedLessonsCount: number;
  currentLessonTitle: string | null;
  currentLessonId: string | null;
  progressPercent: number;
  completedIds: Set<string>;
  hasFullCourseAccess: boolean;
  translate: TranslateFn;
}) {
  return (
    <>
      <details className="mb-6 overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-card lg:hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <List className="size-4" />
              {translate("detail.learn.lessonList.title")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasFullCourseAccess
                ? translate("detail.learn.lessonList.metaFullAccess", {
                    sections: visibleSectionCount,
                    lessons: visibleLessonsCount,
                  })
                : translate("detail.learn.lessonList.metaPreview", {
                    open: visibleLessonsCount,
                    total: sortedLessonsCount,
                  })}
            </p>
            <p className="mt-1 line-clamp-1 text-sm text-foreground">
              {currentLessonTitle ?? translate("detail.learn.selectLessonToStart")}
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {progressPercent}%
            <ChevronDown className="size-3.5" aria-hidden />
          </div>
        </summary>
        <div className="border-t border-border-subtle">
          <CurriculumList
            courseId={courseId}
            groups={groups}
            currentLessonId={currentLessonId}
            completedIds={completedIds}
            hasFullCourseAccess={hasFullCourseAccess}
            translate={translate}
            scrollClassName="max-h-[60vh] overflow-y-auto"
          />
        </div>
      </details>

      <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-elevation-2">
          <div className="border-b border-border-subtle bg-muted/40 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <List className="size-4" />{" "}
                {translate("detail.learn.curriculumTitle")}
              </span>
              <span className="text-xs text-muted-foreground">
                {progressPercent}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <CurriculumList
            courseId={courseId}
            groups={groups}
            currentLessonId={currentLessonId}
            completedIds={completedIds}
            hasFullCourseAccess={hasFullCourseAccess}
            translate={translate}
            scrollClassName="max-h-[68vh] overflow-y-auto"
          />
        </div>
      </aside>
    </>
  );
}

