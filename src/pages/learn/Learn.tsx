import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AlertCircle, CheckCircle2, ChevronLeft, List, PanelLeft, PanelRight } from "lucide-react";
import {
  getNextLesson,
  setLessonProgress,
  sortLessonsByCurriculum,
} from "@/lib/courses";
import { useAuth } from "@/stores/authStore";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  LearnErrorState,
  LearnLoadingState,
  LearnMissingCourseIdState,
} from "./components/LearnStates";
import { LessonCurriculum, type CurriculumGroup } from "./components/LessonCurriculum";
import { LessonPlayerCard } from "./components/LessonPlayerCard";
import { FinalAssignmentPanel } from "./components/FinalAssignmentPanel";
import { SectionQuiz } from "./components/SectionQuiz";
import { getSectionQuestions } from "@/lib/sectionQuestions";
import { getSectionQuizResult } from "@/lib/quizAttempts";
import type { SectionQuestion, SectionQuizResult } from "@/types/questions";
import { useLearnCourseLoad } from "./hooks/useLearnCourseLoad";
import { useLearnEnrollmentAccess } from "./hooks/useLearnEnrollmentAccess";
import { useLearnPaymentReturnFlow } from "./hooks/useLearnPaymentReturnFlow";
import { useLearnProgress } from "./hooks/useLearnProgress";
import { useLearnSubmission } from "./hooks/useLearnSubmission";
import { useCoraStore } from "@/stores/coraStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Learn() {
  const { t } = useTranslation("courses");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const setSidebarMeta = useCoraStore((s) => s.setSidebarMeta);
  const sidebarOpen = useCoraStore((s) => s.sidebarOpen);
  const toggleSidebar = useCoraStore((s) => s.toggleSidebar);
  const { courseId, lessonId } = useParams<{
    courseId: string;
    lessonId?: string;
  }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [curricOpen, setCurricOpen] = useState(true);
  const [sectionQuestions, setSectionQuestions] = useState<SectionQuestion[]>([]);
  const [sectionQuizResult, setSectionQuizResult] = useState<SectionQuizResult | null>(null);

  const courseLoad = useLearnCourseLoad({
    courseId,
    loadCourseErrorFallback: translate("detail.loadCourseErrorFallback"),
    viewer: user,
  });

  const access = useLearnEnrollmentAccess({
    courseId,
    profileId: profile?.id,
    accessModel: courseLoad.course?.access_model,
    role: profile?.role,
  });

  useLearnPaymentReturnFlow({
    courseId,
    profileId: profile?.id,
    paymentAccessCertificateFeePaid: access.paymentAccess?.certificate_fee_paid,
    paymentAccessFullAccessGranted: access.paymentAccess?.full_access_granted,
    setPaymentAccess: access.setPaymentAccess,
    translate,
  });

  const sortedLessons = useMemo(
    () => sortLessonsByCurriculum(courseLoad.lessons, courseLoad.sections),
    [courseLoad.lessons, courseLoad.sections],
  );
  const visibleLessons = useMemo(() => {
    return access.hasFullCourseAccess
      ? sortedLessons
      : sortedLessons.filter((lesson) => lesson.is_preview_free);
  }, [access.hasFullCourseAccess, sortedLessons]);

  const progress = useLearnProgress({
    courseId,
    profileId: profile?.id,
    visibleLessons,
  });

  const submission = useLearnSubmission({
    courseId,
    profileId: profile?.id,
    viewer: user,
  });

  useEffect(() => {
    if (!courseId || visibleLessons.length === 0) return;
    const hasCurrentLesson = lessonId
      ? visibleLessons.some((lesson) => lesson.id === lessonId)
      : false;
    if (hasCurrentLesson) return;
    const next = getNextLesson(visibleLessons, progress.progressList);
    const target = next ?? visibleLessons[0];
    if (target) {
      navigate(`/learn/${courseId}/lesson/${target.id}`, { replace: true });
    }
  }, [courseId, lessonId, navigate, progress.progressList, visibleLessons]);

  const currentLesson = useMemo(() => {
    if (visibleLessons.length === 0 || !lessonId) return null;
    return (
      visibleLessons.find((lesson) => lesson.id === lessonId) ??
      visibleLessons[0] ??
      null
    );
  }, [lessonId, visibleLessons]);

  const isPrivilegedViewer =
    profile?.role === "admin" ||
    profile?.role === "support_staff" ||
    profile?.role === "instructor";
  const isDraftLesson =
    !currentLesson?.youtube_url?.trim() &&
    !currentLesson?.description_markdown?.trim();

  useEffect(() => {
    if (!courseId || !lessonId || !currentLesson) return;
    if (!isDraftLesson) return;
    if (isPrivilegedViewer) return;

    const fallback = visibleLessons.find((l) => l.youtube_url?.trim());
    if (fallback && fallback.id !== currentLesson.id) {
      toast.message(translate("detail.learn.lessonDraftToast"));
      navigate(`/learn/${courseId}/lesson/${fallback.id}`, { replace: true });
    }
  }, [
    courseId,
    currentLesson,
    isDraftLesson,
    isPrivilegedViewer,
    lessonId,
    navigate,
    translate,
    visibleLessons,
  ]);

  useEffect(() => {
    setSidebarMeta({
      courseTitle: courseLoad.course?.title ?? "",
      courseId: courseId ?? null,
      lessonTitle: currentLesson?.title ?? null,
      lessonId: currentLesson?.id ?? null,
    });
    return () => setSidebarMeta(null);
  }, [courseId, courseLoad.course?.title, currentLesson?.id, currentLesson?.title, setSidebarMeta]);

  // Load quiz questions and existing result whenever the current lesson (and its section) changes
  useEffect(() => {
    if (!courseId || !currentLesson?.section_id) {
      setSectionQuestions([]);
      setSectionQuizResult(null);
      return;
    }
    const sectionId = currentLesson.section_id;
    let cancelled = false;

    getSectionQuestions(courseId, sectionId)
      .then((questions) => {
        if (cancelled) return;
        setSectionQuestions(questions);
        if (questions.length === 0) {
          setSectionQuizResult(null);
          return;
        }
        return getSectionQuizResult(courseId, sectionId, questions.length).then((result) => {
          if (!cancelled) setSectionQuizResult(result);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setSectionQuestions([]);
          setSectionQuizResult(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, currentLesson?.section_id]);

  const nextLesson = progress.nextLesson;
  const currentLessonIndex = currentLesson
    ? visibleLessons.findIndex((lesson) => lesson.id === currentLesson.id)
    : -1;
  const previousLesson =
    currentLessonIndex > 0 ? visibleLessons[currentLessonIndex - 1] : null;

  const lessonIndexForPlayer = currentLesson ? currentLessonIndex : null;

  const lessonsBySection = useMemo<CurriculumGroup[]>(
    () =>
      courseLoad.sections.map((section) => ({
        section,
        lessons: sortedLessons.filter((lesson) => lesson.section_id === section.id),
      })),
    [courseLoad.sections, sortedLessons],
  );
  const visibleSectionCount = lessonsBySection.filter(
    ({ lessons: sectionLessons }) => sectionLessons.length > 0,
  ).length;

  const markComplete = async () => {
    if (!currentLesson || !courseId || !access.hasFullCourseAccess) return;
    if (isDraftLesson) return;
    try {
      await setLessonProgress(currentLesson.id, courseId, true, undefined, user);
      progress.setProgressList((prev) => {
        const existing = prev.find((progress) => progress.lesson_id === currentLesson.id);
        const next = prev.filter((progress) => progress.lesson_id !== currentLesson.id);
        next.push({
          id: existing?.id ?? `${courseId}_${currentLesson.id}`,
          lesson_id: currentLesson.id,
          course_id: courseId,
          user_id: profile?.id ?? "",
          completed_at: new Date().toISOString(),
          watch_seconds: existing?.watch_seconds,
        });
        return next;
      });
    } catch (e) {
      console.warn("Could not update progress", e);
    }
  };

  if (!courseId) {
    return <LearnMissingCourseIdState translate={translate} />;
  }

  if (courseLoad.loading) {
    return <LearnLoadingState translate={translate} />;
  }

  if (courseLoad.error || !courseLoad.course) {
    return (
      <LearnErrorState
        translate={translate}
        message={courseLoad.error ?? translate("detail.notFound")}
      />
    );
  }

  const course = courseLoad.course;
  const accessModel = course.access_model ?? "free";
  const hasFullCourseAccess = access.hasFullCourseAccess;

  const shouldShowFinalAssignment =
    !nextLesson && hasFullCourseAccess && !!course.final_assignment_title;

  const curriculumProps = {
    courseId: courseId,
    groups: lessonsBySection,
    visibleSectionCount,
    visibleLessonsCount: visibleLessons.length,
    sortedLessonsCount: sortedLessons.length,
    currentLessonTitle: currentLesson?.title ?? null,
    currentLessonId: currentLesson?.id ?? null,
    progressPercent: progress.progressPercent,
    completedIds: progress.completedIds,
    completedCount: progress.completedIds.size,
    lessonTotal: visibleLessons.length,
    nextLessonTitle: nextLesson?.title ?? null,
    hasFullCourseAccess,
    translate,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Slim top bar */}
      <div className="relative flex h-12 shrink-0 items-center border-b border-border-subtle bg-surface-raised px-3">
        {/* Left */}
        <div className="flex items-center gap-1">
          {/* Desktop: toggle left curriculum sidebar */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurricOpen((v) => !v)}
            aria-label="Toggle curriculum"
            className={cn(
              "hidden xl:inline-flex",
              curricOpen && "bg-primary-muted text-primary hover:bg-primary-muted hover:text-primary",
            )}
          >
            <PanelLeft className="size-4" aria-hidden />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link to={`/courses/${courseId}`} />}
            nativeButton={false}
            aria-label={translate("detail.learn.backToCourse")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
        </div>

        {/* Center — absolutely centered so it doesn't depend on left/right widths */}
        <div className="absolute left-1/2 -translate-x-1/2 flex max-w-[50%] items-center gap-1.5 overflow-hidden text-sm">
          <span className="shrink-0 truncate font-medium text-foreground">
            {course.title}
          </span>
          {currentLesson && (
            <>
              <span className="shrink-0 text-foreground-subtle">/</span>
              <span className="truncate text-foreground-muted">{currentLesson.title}</span>
            </>
          )}
        </div>

        {/* Right */}
        <div className="ml-auto flex items-center gap-1">
          {/* Mobile: open curriculum sheet */}
          <Sheet>
            <SheetTrigger
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-raised hover:text-foreground xl:hidden"
              aria-label="Open curriculum"
            >
              <List className="size-4" aria-hidden />
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>{translate("detail.learn.curriculumTitle")}</SheetTitle>
              </SheetHeader>
              <LessonCurriculum variant="sidebar" {...curriculumProps} />
            </SheetContent>
          </Sheet>

          {/* Desktop: toggle Cora AI sidebar */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            aria-label="Toggle Cora AI"
            className={cn(
              "hidden xl:inline-flex",
              sidebarOpen && "bg-primary-muted text-primary hover:bg-primary-muted hover:text-primary",
            )}
          >
            <PanelRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left curriculum sidebar — desktop only */}
        <aside
          className={cn(
            "hidden xl:flex flex-col shrink-0 border-r border-border-subtle",
            "overflow-hidden transition-[width] duration-200 ease-in-out",
            curricOpen ? "w-[280px]" : "w-0",
          )}
        >
          <div className="flex flex-col w-[280px] h-full">
            <LessonCurriculum variant="sidebar" {...curriculumProps} />
          </div>
        </aside>

        {/* Main lesson content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {(!hasFullCourseAccess ||
            (accessModel === "paid_upfront" &&
              access.enrolled &&
              !access.paymentAccess?.full_access_granted)) && (
            <div className="px-4 pt-4 sm:px-6">
              {!hasFullCourseAccess ? (
                <div className="mb-2 flex items-center gap-3 rounded-md border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
                  <p>{translate("detail.learn.previewModeNotice")}</p>
                </div>
              ) : null}
              {accessModel === "paid_upfront" &&
              access.enrolled &&
              !access.paymentAccess?.full_access_granted ? (
                <div className="mb-2 flex items-center gap-3 rounded-md border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
                  <p>{translate("detail.accessPanel.keptAccess")}</p>
                </div>
              ) : null}
            </div>
          )}

          <LessonPlayerCard
            lesson={currentLesson}
            lessonIndex={lessonIndexForPlayer}
            isDraftLesson={!!currentLesson && isDraftLesson}
            completed={!!currentLesson && progress.completedIds.has(currentLesson.id)}
            hasFullCourseAccess={hasFullCourseAccess}
            previousLesson={previousLesson}
            nextLesson={nextLesson}
            translate={translate}
            onMarkComplete={() => void markComplete()}
            onNavigateToLesson={(id) => navigate(`/learn/${courseId}/lesson/${id}`)}
          />

          {sectionQuestions.length > 0 && currentLesson?.section_id && courseId && (
            <SectionQuiz
              courseId={courseId}
              sectionId={currentLesson.section_id}
              sectionTitle={
                courseLoad.sections.find((s) => s.id === currentLesson.section_id)?.title ?? ""
              }
              questions={sectionQuestions}
              existingResult={sectionQuizResult}
              onResultUpdate={setSectionQuizResult}
            />
          )}

          {shouldShowFinalAssignment ? (
            <div className="px-4 pb-8 sm:px-6">
              <FinalAssignmentPanel
                courseId={courseId}
                course={course}
                profileId={profile?.id ?? ""}
                isAdmin={profile?.role === "admin"}
                certificateFeePaid={!!access.paymentAccess?.certificate_fee_paid}
                submission={submission.submission as never}
                translate={translate}
                onSubmit={async (input) => {
                  await submission.submit(input);
                }}
              />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
