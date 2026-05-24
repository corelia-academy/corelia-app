import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CourseBadge } from "./CourseBadge";
import { isLessonDraftForLearners } from "@/lib/lessonFormat";
import {
  formatDuration,
  type CourseLesson,
  type CourseSection,
} from "@/types/courses";

export interface CurriculumGroup {
  section: CourseSection;
  lessons: CourseLesson[];
}

function LessonRow({
  lesson,
  index,
  isPaidUpfront,
  translate,
}: {
  lesson: CourseLesson;
  index: number;
  isPaidUpfront: boolean;
  translate: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 sm:items-center">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-medium text-foreground-muted">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-foreground sm:line-clamp-1">
          {lesson.title}
        </p>
        {lesson.short_description?.trim() ? (
          <p className="mt-1 line-clamp-2 text-xs text-foreground-muted">
            {lesson.short_description}
          </p>
        ) : null}
        <p className="mt-0.5 text-xs text-foreground-muted">
          {formatDuration(lesson.duration_seconds)}
        </p>
      </div>
      {isPaidUpfront && lesson.is_preview_free ? (
        <CourseBadge className="mt-0.5 sm:mt-0" variant="success">
          {translate("detail.courseDetail.previewLessonBadge")}
        </CourseBadge>
      ) : null}
      {isLessonDraftForLearners(lesson) ? (
        <CourseBadge className="mt-0.5 sm:mt-0" variant="warning">
          {translate("detail.courseDetail.lessonDraftBadge")}
        </CourseBadge>
      ) : null}
    </div>
  );
}

interface CourseCurriculumProps {
  visibleLessonGroups: CurriculumGroup[];
  isPaidUpfront: boolean;
  isPreviewOnlyCurriculum: boolean;
  hasSections?: boolean;
}

export function CourseCurriculum({
  visibleLessonGroups,
  isPaidUpfront,
  isPreviewOnlyCurriculum,
  hasSections = true,
}: CourseCurriculumProps) {
  const { t } = useTranslation("courses");
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <BookOpen className="size-5 shrink-0" aria-hidden />{" "}
            {translate("detail.courseDetail.curriculum.title")}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {isPreviewOnlyCurriculum
              ? translate(
                  "detail.courseDetail.curriculum.previewDescription",
                )
              : translate(
                  "detail.courseDetail.curriculum.fullDescription",
                )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasSections && (
            <>
              <div className="rounded-full bg-surface-raised px-3 py-1 text-xs text-foreground-muted">
                {translate("detail.courseDetail.sectionCount", {
                  count: visibleLessonGroups.length,
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => {
                  setCollapsedSections((prev) => {
                    const next = new Set(prev);
                    const allIds = visibleLessonGroups.map((g) => g.section.id);
                    const allCollapsed =
                      allIds.length > 0 && allIds.every((sid) => next.has(sid));
                    if (allCollapsed) {
                      allIds.forEach((sid) => next.delete(sid));
                      return next;
                    }
                    allIds.forEach((sid) => next.add(sid));
                    return next;
                  });
                }}
              >
                {translate("detail.courseDetail.curriculum.collapseAll")}
              </Button>
            </>
          )}
        </div>
      </div>

      {hasSections ? (
      <div className="space-y-3">
        {visibleLessonGroups.map(
          ({ section, lessons: sectionLessons }, sectionIndex) => {
            const isCollapsed = collapsedSections.has(section.id);
            return (
              <div
                key={section.id}
                className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedSections((prev) => {
                      const next = new Set(prev);
                      if (next.has(section.id)) next.delete(section.id);
                      else next.add(section.id);
                      return next;
                    })
                  }
                  className="flex w-full flex-col gap-2 border-b border-border-subtle bg-surface-raised px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-overlay sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                      {translate("detail.courseDetail.sectionLabel", {
                        index: sectionIndex + 1,
                      })}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {section.title}
                    </p>
                    {section.description?.trim() ? (
                      <p className="mt-1 line-clamp-2 text-xs text-foreground-muted">
                        {section.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground-muted">
                    <span>
                      {translate("detail.courseDetail.lessonCountShort", {
                        count: sectionLessons.length,
                      })}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 transition-transform duration-200",
                        isCollapsed ? "-rotate-90" : "rotate-0",
                      )}
                      aria-hidden
                    />
                  </div>
                </button>
                {!isCollapsed ? (
                  <div className="divide-y divide-border-subtle">
                    {sectionLessons.map((lesson, lessonIndex) => (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        index={lessonIndex}
                        isPaidUpfront={isPaidUpfront}
                        translate={translate}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          },
        )}
      </div>
      ) : (
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card divide-y divide-border-subtle">
        {visibleLessonGroups.flatMap(({ lessons: sectionLessons }) => sectionLessons).map((lesson, index) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            index={index}
            isPaidUpfront={isPaidUpfront}
            translate={translate}
          />
        ))}
      </div>
      )}
    </section>
  );
}
