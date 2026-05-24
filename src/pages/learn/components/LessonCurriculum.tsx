import { Link } from "react-router";
import { CheckCircle2, ChevronDown, FileText, List, Lock, PlayCircle } from "lucide-react";
import { isArticleLesson } from "@/lib/lessonFormat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/types/courses";
import type { CourseLesson, CourseSection } from "@/types/courses";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function LessonItem({
  courseId,
  lesson,
  currentLessonId,
  completedIds,
  hasFullCourseAccess,
  translate,
}: {
  courseId: string;
  lesson: import("@/types/courses").CourseLesson;
  currentLessonId: string | null;
  completedIds: Set<string>;
  hasFullCourseAccess: boolean;
  translate: TranslateFn;
}) {
  const done = completedIds.has(lesson.id);
  const active = currentLessonId === lesson.id;
  const locked = !hasFullCourseAccess && !lesson.is_preview_free;
  const article = isArticleLesson(lesson);
  return (
    <div
      className={cn(
        "border-t border-border-subtle border-l-[3px] pl-[calc(1rem-3px)] pr-4 py-3 transition-colors duration-150",
        active ? "bg-primary-muted text-primary border-l-brand-accent" : "border-l-transparent",
        !locked && "hover:bg-surface-raised",
        locked && "opacity-75",
      )}
    >
      {locked ? (
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 w-4 h-4 shrink-0 text-foreground-muted" aria-hidden />
          <span className="min-w-0 flex-1 line-clamp-2 text-sm leading-5 text-foreground-muted">
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
            <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0 text-success sm:mt-0" aria-hidden />
          ) : article ? (
            <FileText className="mt-0.5 w-4 h-4 shrink-0 text-foreground-muted sm:mt-0" aria-hidden />
          ) : (
            <PlayCircle className="mt-0.5 w-4 h-4 shrink-0 text-foreground-muted sm:mt-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "block line-clamp-2 text-sm leading-5 sm:line-clamp-1",
                active ? "font-medium text-primary" : "text-foreground",
              )}
            >
              {lesson.title}
            </span>
            <span className="mt-1 block text-xs text-foreground-muted sm:hidden">
              {formatDuration(lesson.duration_seconds)}
            </span>
          </div>
          <span className="hidden shrink-0 text-xs text-foreground-muted sm:inline">
            {formatDuration(lesson.duration_seconds)}
          </span>
        </Link>
      )}
    </div>
  );
}

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
  hasSections,
  translate,
  scrollClassName,
}: {
  courseId: string;
  groups: CurriculumGroup[];
  currentLessonId: string | null;
  completedIds: Set<string>;
  hasFullCourseAccess: boolean;
  hasSections: boolean;
  translate: TranslateFn;
  scrollClassName?: string;
}) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex w-12 h-12 items-center justify-center rounded-full bg-surface-raised">
          <List className="w-6 h-6 text-foreground-subtle" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {translate("detail.learn.emptyCurriculumTitle")}
          </p>
          <p className="mt-0.5 text-xs text-foreground-muted">
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

  const flatLessons = hasSections ? null : groups.flatMap(({ lessons }) => lessons);

  return (
    <div className={cn(scrollClassName)}>
      {hasSections
        ? groups.map(({ section, lessons: sectionLessons }) => (
            <div key={section.id}>
              <div className="bg-surface-raised px-4 py-2 text-xs font-medium text-foreground">
                {section.title}
              </div>
              {sectionLessons.map((lesson) => (
                <LessonItem
                  key={lesson.id}
                  courseId={courseId}
                  lesson={lesson}
                  currentLessonId={currentLessonId}
                  completedIds={completedIds}
                  hasFullCourseAccess={hasFullCourseAccess}
                  translate={translate}
                />
              ))}
            </div>
          ))
        : flatLessons!.map((lesson) => (
            <LessonItem
              key={lesson.id}
              courseId={courseId}
              lesson={lesson}
              currentLessonId={currentLessonId}
              completedIds={completedIds}
              hasFullCourseAccess={hasFullCourseAccess}
              translate={translate}
            />
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
  completedCount,
  lessonTotal,
  nextLessonTitle,
  hasFullCourseAccess,
  hasSections = true,
  translate,
  variant = "default",
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
  completedCount: number;
  lessonTotal: number;
  nextLessonTitle: string | null;
  hasFullCourseAccess: boolean;
  hasSections?: boolean;
  translate: TranslateFn;
  variant?: "default" | "tabPanel" | "sidebar";
}) {
  const completedLabel = `${translate("detail.learn.stats.completedLessons")}: ${completedCount}/${lessonTotal}`;
  const nextUpLabel = `${translate("detail.learn.stats.nextUp")}: ${
    nextLessonTitle ?? translate("detail.learn.completedPath")
  }`;

  const curriculumCard = (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
      <div className="border-b border-border-subtle bg-surface-raised px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <List className="w-4 h-4" /> {translate("detail.learn.curriculumTitle")}
          </span>
          <span className="text-xs text-foreground-muted">{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-base">
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-foreground-muted">{completedLabel}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-foreground-muted">{nextUpLabel}</p>
      </div>

      <CurriculumList
        courseId={courseId}
        groups={groups}
        currentLessonId={currentLessonId}
        completedIds={completedIds}
        hasFullCourseAccess={hasFullCourseAccess}
        hasSections={hasSections}
        translate={translate}
        scrollClassName="max-h-[min(72vh,560px)] overflow-y-auto"
      />
    </div>
  );

  if (variant === "tabPanel") {
    return curriculumCard;
  }

  if (variant === "sidebar") {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 border-b border-border-subtle bg-surface-raised px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <List className="w-4 h-4" aria-hidden />
              {translate("detail.learn.curriculumTitle")}
            </span>
            <span className="text-xs text-foreground-muted">{progressPercent}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-base">
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-foreground-muted">{completedLabel}</p>
        </div>
        <CurriculumList
          courseId={courseId}
          groups={groups}
          currentLessonId={currentLessonId}
          completedIds={completedIds}
          hasFullCourseAccess={hasFullCourseAccess}
          hasSections={hasSections}
          translate={translate}
          scrollClassName="flex-1 overflow-y-auto"
        />
      </div>
    );
  }

  return (
    <>
      <details className="mb-6 overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card lg:hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <List className="w-4 h-4" />
              {translate("detail.learn.lessonList.title")}
            </div>
            <p className="mt-1 text-xs text-foreground-muted">
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
            <p className="mt-1 text-xs text-foreground-muted">
              {completedLabel}
            </p>
            <p className="mt-0.5 line-clamp-1 text-xs text-foreground-muted">
              {nextUpLabel}
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-surface-raised px-3 py-1 text-xs text-foreground-muted">
            {progressPercent}%
            <ChevronDown className="w-3 h-3" aria-hidden />
          </div>
        </summary>
        <div className="border-t border-border-subtle">
          <CurriculumList
            courseId={courseId}
            groups={groups}
            currentLessonId={currentLessonId}
            completedIds={completedIds}
            hasFullCourseAccess={hasFullCourseAccess}
            hasSections={hasSections}
            translate={translate}
            scrollClassName="max-h-[60vh] overflow-y-auto"
          />
        </div>
      </details>

      <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">{curriculumCard}</aside>
    </>
  );
}
