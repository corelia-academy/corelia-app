import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { lessonText } from "@/features/learning/lessonCopy";
import { Link } from "react-router";
import { CaretDown, CheckSquare, Code, FileText, List, PencilLine, PlayCircle, SidebarSimple } from "@phosphor-icons/react";
import { Action } from "@/components/ui/action";
import { ProgressCircle } from "@/components/ui/progress";
import { getLessonFormat, isArticleLesson } from "@/lib/lessonFormat";
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
  void hasFullCourseAccess;
  const format = getLessonFormat(lesson);
  const Icon = format === "code_exercise" ? Code
    : format === "practice" ? PencilLine
    : format === "quiz" ? CheckSquare
    : isArticleLesson(lesson) ? FileText
    : PlayCircle;

  return (
    <Action
      type="button"
      size="small"
      className="rounded-md py-2md hover:rounded-md"
      isActive={active}
      icon={<Icon weight="duotone" aria-hidden />}
      label={lessonText(lesson.title)}
      trailingGroup={done ? (
        <ProgressCircle aria-label={translate("detail.learn.stats.completedLessons")} done className="size-4" />
      ) : lesson.duration_seconds > 0 ? (
        <span className="font-body text-label-small leading-[1.4] text-action-supporting">
          {formatDuration(lesson.duration_seconds)}
        </span>
      ) : undefined}
      render={<Link to={`/study/${courseId}/lesson/${lesson.id}`} />}
      nativeButton={false}
    />
  );
}

function CurriculumSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const regionRef = useRef<HTMLDivElement>(null);
  const previousOpen = useRef(open);
  const regionId = useId();

  // Animates only real open/close changes, so the first render and StrictMode re-runs stay still.
  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region || previousOpen.current === open) return;
    previousOpen.current = open;
    gsap.killTweensOf(region);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(region, open ? { clearProps: "display,height,overflow" } : { display: "none" });
      return;
    }
    gsap.set(region, { display: "block", overflow: "hidden" });
    if (open) {
      gsap.fromTo(region, { height: 0 }, { height: "auto", duration: 0.28, ease: "power3.out", clearProps: "display,height,overflow" });
    } else {
      gsap.to(region, { height: 0, duration: 0.2, ease: "power2.in", onComplete: () => gsap.set(region, { display: "none" }) });
    }
  }, [open]);

  return (
    <section data-open={open} className="flex flex-col [[data-open=false]+&]:-mt-px">
      <div className="border-y border-border px-lg">
        <Action
          type="button"
          size="large"
          className="cursor-pointer rounded-md hover:rounded-md hover:bg-transparent [&_span]:transition-colors hover:[&_span]:text-button-secondary-foreground"
          label={title}
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen((value) => !value)}
          trailingGroup={
            <CaretDown aria-hidden weight="duotone" className={cn("size-4 transition-transform", !open && "-rotate-90")} />
          }
        />
      </div>
      <div ref={regionRef} id={regionId} inert={!open}>
        <div className="flex flex-col px-2xl pt-md [section:not(:last-child)_&]:pb-2xl">{children}</div>
      </div>
    </section>
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
  hasFinalAssignment = false,
  isFinalAssignment = false,
  hasSections,
  translate,
  scrollClassName,
}: {
  courseId: string;
  groups: CurriculumGroup[];
  currentLessonId: string | null;
  completedIds: Set<string>;
  hasFullCourseAccess: boolean;
  hasFinalAssignment?: boolean;
  isFinalAssignment?: boolean;
  hasSections: boolean;
  translate: TranslateFn;
  scrollClassName?: string;
}) {
  if (groups.length === 0 && !hasFinalAssignment) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex w-12 h-12 items-center justify-center rounded-full bg-surface-raised">
          <List weight="duotone" className="w-6 h-6 text-foreground-subtle" aria-hidden />
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
          size="small"
          variant="cta" hierarchy="secondary"
          render={<Link to={`/courses/${courseId}`} />}
          nativeButton={false}
        >
          {translate("detail.learn.backToCourse")}
        </Button>
      </div>
    );
  }

  const flatLessons = hasSections ? null : groups.flatMap(({ lessons }) => lessons);
  const renderLesson = (lesson: CourseLesson) => (
    <LessonItem
      key={lesson.id}
      courseId={courseId}
      lesson={lesson}
      currentLessonId={currentLessonId}
      completedIds={completedIds}
      hasFullCourseAccess={hasFullCourseAccess}
      translate={translate}
    />
  );

  return (
    <div className={cn(scrollClassName)}>
      <div className="flex flex-col pb-2xl">
        {hasSections
          ? groups.map(({ section, lessons: sectionLessons }) => (
              <CurriculumSection key={section.id} title={section.title}>
                {sectionLessons.map(renderLesson)}
              </CurriculumSection>
            ))
          : <div className="flex flex-col px-2xl not-last:pb-2xl">{flatLessons!.map(renderLesson)}</div>}
        {hasFinalAssignment && hasFullCourseAccess && (
          <div className="px-2xl transition-[padding-top] duration-300 ease-out [[data-open=false]+&]:pt-2xl">
            <Action
              type="button"
              size="small"
              isActive={isFinalAssignment}
              aria-current={isFinalAssignment ? "page" : undefined}
              icon={<FileText weight="duotone" aria-hidden />}
              label={translate("detail.learn.finalAssignmentTitle")}
              render={<Link to={`/study/${courseId}/final-assignment`} />}
              nativeButton={false}
            />
          </div>
        )}
      </div>
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
  hasFinalAssignment = false,
  isFinalAssignment = false,
  hasSections = true,
  translate,
  variant = "default",
  onTogglePanel,
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
  hasFinalAssignment?: boolean;
  isFinalAssignment?: boolean;
  hasSections?: boolean;
  translate: TranslateFn;
  variant?: "default" | "tabPanel" | "sidebar";
  onTogglePanel?: () => void;
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
            <List weight="duotone" className="w-4 h-4" /> {translate("detail.learn.curriculumTitle")}
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
        hasFinalAssignment={hasFinalAssignment}
        isFinalAssignment={isFinalAssignment}
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
        <div className="shrink-0">
          <div className="flex items-center gap-xl border-b border-border bg-sidebar px-xl py-xl xl:px-4xl">
            <ProgressCircle
              aria-label={`${translate("detail.learn.curriculumTitle")} ${progressPercent}%`}
              process
              percentage={progressPercent}
              done={progressPercent >= 100}
            />
            <h2 className="min-w-0 flex-1 select-none truncate text-center font-display text-heading-medium text-action-text">
              {translate("detail.learn.curriculumTitle")}
            </h2>
            {onTogglePanel ? (
              <Button
                variant="cta" hierarchy="tertiary" iconOnly
                size="small"
                onClick={onTogglePanel}
                aria-label={translate("detail.learn.toggleCurriculum")}
              >
                <SidebarSimple weight="duotone" className="size-6" aria-hidden />
              </Button>
            ) : <span className="size-6" aria-hidden />}
          </div>
          {/* TODO(figma-learn): Figma Curriculum không có dòng "Completed", tạm ẩn chờ thiết kế
          <p className="select-none px-xl py-2md text-xs text-foreground-subtle xl:px-4xl">{completedLabel}</p>
          */}
        </div>
        <CurriculumList
          courseId={courseId}
          groups={groups}
          currentLessonId={currentLessonId}
          completedIds={completedIds}
          hasFullCourseAccess={hasFullCourseAccess}
          hasFinalAssignment={hasFinalAssignment}
          isFinalAssignment={isFinalAssignment}
          hasSections={hasSections}
          translate={translate}
          scrollClassName="scrollbar-design flex-1 overflow-y-auto"
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
              <List weight="duotone" className="w-4 h-4" />
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
            <CaretDown weight="duotone" className="w-3 h-3" aria-hidden />
          </div>
        </summary>
        <div className="border-t border-border-subtle">
          <CurriculumList
            courseId={courseId}
            groups={groups}
            currentLessonId={currentLessonId}
            completedIds={completedIds}
            hasFullCourseAccess={hasFullCourseAccess}
            hasFinalAssignment={hasFinalAssignment}
            isFinalAssignment={isFinalAssignment}
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
