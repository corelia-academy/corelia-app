import { lessonText } from "@/features/learning/lessonCopy";
import { recordLearningEvent } from "@/lib/learning";
import { invalidateLearningProgress } from "@/features/learning/invalidateLearningProgress";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ChevronLeft,
  List,
  PanelLeft,
} from "lucide-react";
import {
  checkAndIssueCertificate,
  courseHasCertificate,
  ensureEnrollmentForProgress,
  getNextLesson,
  setLessonProgress,
  sortLessonsByCurriculum,
  syncCourseCompletion,
} from "@/lib/courses";
import { invokeCheckCourseCredential } from "@/lib/credentialsEdge";
import {
  isLessonDraftForLearners,
} from "@/lib/lessonFormat";
import { useAuth } from "@/stores/authStore";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  LearnErrorState,
  LearnLoadingState,
  LearnMissingCourseIdState,
} from "./components/LearnStates";
import {
  LessonCurriculum,
  type CurriculumGroup,
} from "./components/LessonCurriculum";
import { LessonPlayerCard } from "./components/LessonPlayerCard";
import { FinalAssignmentPanel } from "./components/FinalAssignmentPanel";
import { SectionQuiz } from "./components/SectionQuiz";
import { useLearnCourseLoad } from "./hooks/useLearnCourseLoad";
import { useLearnEnrollmentAccess } from "./hooks/useLearnEnrollmentAccess";
import { useLearnProgress } from "./hooks/useLearnProgress";
import { useLearnSubmission } from "./hooks/useLearnSubmission";
import { Button } from "@/components/ui/button";
import { CourseCompletionCertificatePanel } from "@/components/courses/CourseCompletionCertificatePanel";
import { cn } from "@/lib/utils";
import type { CertificateIssueReason } from "@/lib/courses";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizablePanelHandle,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  sectionQuizQueryOptions,
  type SectionQuizQueryData,
} from "@/features/courses/quizQueries";

const DESKTOP_BREAKPOINT_QUERY = "(min-width: 1280px)";

function subscribeDesktopBreakpoint(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange);
  };
}

function getDesktopBreakpointSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
}

export default function Learn() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  return <LearnWorkspace key={`${courseId}:${user?.id ?? "anonymous"}`} />;
}

function LearnWorkspace() {
  const { t } = useTranslation("courses");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const { courseId, lessonId } = useParams<{
    courseId: string;
    lessonId?: string;
  }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const activeWorkspace = useRef(true);
  useEffect(() => {
    activeWorkspace.current = true;
    return () => { activeWorkspace.current = false; };
  }, []);
  const isDesktop = useSyncExternalStore(
    subscribeDesktopBreakpoint,
    getDesktopBreakpointSnapshot,
    () => false,
  );
  const [curricOpen, setCurricOpen] = useState(true);
  const curriculumPanelRef = useRef<ResizablePanelHandle | null>(null);
  const completionSyncAttemptedRef = useRef<Set<string>>(new Set());
  const [completionSyncing, setCompletionSyncing] = useState(false);
  const [completionJustSynced, setCompletionJustSynced] = useState(false);
  const [completionSyncError, setCompletionSyncError] = useState<string | null>(null);
  const [certificateAutoIssuing, setCertificateAutoIssuing] = useState(false);
  const [certificateJustIssued, setCertificateJustIssued] = useState(false);
  const [certificateIssueReason, setCertificateIssueReason] =
    useState<CertificateIssueReason | null>(null);
  const [certificateIssueError, setCertificateIssueError] = useState<string | null>(null);

  const courseLoad = useLearnCourseLoad({
    courseId,
    loadCourseErrorFallback: translate("detail.loadCourseErrorFallback"),
    viewer: user,
  });

  const access = useLearnEnrollmentAccess({
    courseId,
    profileId: profile?.id,
  });

  const sortedLessons = useMemo(
    () => sortLessonsByCurriculum(courseLoad.lessons, courseLoad.sections),
    [courseLoad.lessons, courseLoad.sections],
  );
  const visibleLessons = useMemo(() => sortedLessons.filter(l => l.published !== false && !l.archived_at), [sortedLessons]);

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

  const syncCertificate = useCallback(async () => {
    const course = courseLoad.course;
    if (!courseId || !profile?.id || !course) return null;
    let phase: "completion" | "certificate" = "completion";
    let completionConfirmed = false;
    setCertificateIssueReason(null);
    setCertificateIssueError(null);
    try {
      const enrollment = await ensureEnrollmentForProgress(
        profile.id,
        courseId,
        new Date().toISOString(),
      );
      if (!activeWorkspace.current) return null;
      if (enrollment) access.setEnrollment(enrollment);
      setCompletionSyncing(true);
      setCompletionSyncError(null);
      const completion = await syncCourseCompletion(profile.id, courseId);
      completionConfirmed = completion.completed;
      if (!activeWorkspace.current) return null;
      let baseEnrollment = enrollment ?? access.enrollment;
      if (completion.completed) {
        completionConfirmed = true;
        const completedAt = completion.completed_at || baseEnrollment?.completed_at || new Date().toISOString();
        if (baseEnrollment) {
          baseEnrollment = { ...baseEnrollment, completed_at: completedAt };
          access.setEnrollment(baseEnrollment);
        }
        setCompletionJustSynced(true);
      } else {
        if (completion.reason === "final_assignment_pending") return null;
        setCompletionSyncError(
          completion.message || translate("detail.learn.completion.completionSyncFailed"),
        );
        return null;
      }
      setCompletionSyncing(false);
      phase = "certificate";
      const credentialCheck = await invokeCheckCourseCredential(courseId, undefined, {
        autoIssue: true,
      });
      if (!activeWorkspace.current) return null;
      if (credentialCheck.reason === "oca_requires_manual_claim") {
        toast.success(translate("detail.courseDetail.ocaReady"), {
          action: {
            label: translate("detail.courseDetail.viewAchievements"),
            onClick: () => navigate("/achievements"),
          },
        });
      }
      if (!courseHasCertificate(course)) {
        return null;
      }
      setCertificateAutoIssuing(true);
      const result = await checkAndIssueCertificate(profile.id, courseId);
      if (!activeWorkspace.current) return null;
      setCertificateIssueReason(result.reason);
      if (result.issued) {
        const issuedAt = result.certificate_issued_at || new Date().toISOString();
        if (baseEnrollment) {
          access.setEnrollment({ ...baseEnrollment, certificate_issued_at: issuedAt });
        }
        setCertificateJustIssued(true);
        void progress.refresh();
        toast.success(translate("detail.courseDetail.certificateIssuedSuccess"), {
          action: {
            label: translate("detail.courseDetail.viewCertificate"),
            onClick: () => navigate("/achievements"),
          },
        });
      } else if (result.message) {
        setCertificateIssueError(result.message);
      }
      return result;
    } catch (err) {
      if (!activeWorkspace.current) return null;
      const message = err instanceof Error
        ? err.message
        : translate("detail.courseDetail.claimCertificateFailed");
      if (phase === "certificate") setCertificateIssueError(message);
      else setCompletionSyncError(message);
      console.warn("[learn] certificate sync failed", {
        userId: profile.id,
        courseId,
        error: message,
      });
      return null;
    } finally {
      if (activeWorkspace.current) {
        setCompletionSyncing(false);
        setCertificateAutoIssuing(false);
      }
      if (completionConfirmed) await invalidateLearningProgress(queryClient, profile.id, courseId);
    }
  }, [
    queryClient,
    access,
    courseId,
    courseLoad.course,
    profile?.id,
    progress,
    navigate,
    translate,
  ]);

  useEffect(() => {
    const course = courseLoad.course;
    if (!courseId || !profile?.id || !course) return;
    if (progress.progressPercent < 100) return;
    if (course.final_assignment_title && submission.submission?.status !== "approved") return;
    if (access.enrollment?.completed_at && (!courseHasCertificate(course) || access.enrollment.certificate_issued_at)) {
      return;
    }
    const key = `${profile.id}:${courseId}:${submission.submission?.status ?? "none"}`;
    if (completionSyncAttemptedRef.current.has(key)) return;
    completionSyncAttemptedRef.current.add(key);
    void syncCertificate();
  }, [
    access.enrollment,
    courseId,
    courseLoad.course,
    profile?.id,
    progress.progressPercent,
    syncCertificate,
    submission.submission?.status,
  ]);

  useEffect(() => {
    if (!courseId || visibleLessons.length === 0) return;
    // If URL already contains an explicit lessonId, do not auto-redirect
    if (lessonId) return;

    const next = getNextLesson(visibleLessons, progress.progressList);
    const target = next ?? visibleLessons[0];
    if (target) {
      navigate(`/learn/${courseId}/lesson/${target.id}`, { replace: true });
    }
  }, [courseId, lessonId, navigate, progress.progressList, visibleLessons]);

  const rawLesson = useMemo(() => {
    if (!lessonId || sortedLessons.length === 0) return null;
    return sortedLessons.find((lesson) => lesson.id === lessonId) ?? null;
  }, [lessonId, sortedLessons]);

  const currentLesson = useMemo(() => {
    if (visibleLessons.length === 0 || !lessonId) return null;
    return visibleLessons.find((lesson) => lesson.id === lessonId) ?? null;
  }, [lessonId, visibleLessons]);

  const isDraftLesson = currentLesson ? isLessonDraftForLearners(currentLesson) : false;
  useEffect(() => {
    if (!courseId || !lessonId || courseLoad.loading || currentLesson || !visibleLessons.length) return;
    toast.message(translate("learning.invalidRoute"));
    navigate(`/learn/${courseId}/lesson/${visibleLessons[0].id}`, { replace: true });
  }, [courseId, lessonId, courseLoad.loading, currentLesson, visibleLessons, navigate, translate]);
  useEffect(() => {
    if (user && currentLesson && courseId) void recordLearningEvent(courseId, currentLesson.id, "lesson_started");
  }, [user, courseId, currentLesson]);

  const sectionQuizOptions = sectionQuizQueryOptions({
    userId: user?.id,
    courseId: courseId ?? "",
    sectionId: currentLesson?.section_id ?? "",
  });
  const sectionQuizQuery = useQuery(sectionQuizOptions);
  const sectionQuestions = sectionQuizQuery.data?.questions ?? [];
  const sectionQuizResult = sectionQuizQuery.data?.existingResult ?? null;

  const nextLesson = progress.nextLesson;
  const currentLessonIndex = currentLesson
    ? visibleLessons.findIndex((lesson) => lesson.id === currentLesson.id)
    : -1;
  const previousLesson =
    currentLessonIndex > 0 ? visibleLessons[currentLessonIndex - 1] : null;
  const nextLessonInSequence =
    currentLessonIndex >= 0 && currentLessonIndex < visibleLessons.length - 1
      ? visibleLessons[currentLessonIndex + 1]
      : null;

  const lessonIndexForPlayer = currentLesson ? currentLessonIndex : null;

  const lessonsBySection = useMemo<CurriculumGroup[]>(
    () =>
      courseLoad.sections.map((section) => ({
        section,
        lessons: visibleLessons.filter(
          (lesson) => lesson.section_id === section.id,
        ),
      })),
    [courseLoad.sections, visibleLessons],
  );
  const visibleSectionCount = lessonsBySection.filter(
    ({ lessons: sectionLessons }) => sectionLessons.length > 0,
  ).length;

  const completeMutation = useMutation({ mutationFn: async () => {
    if (!currentLesson || !courseId || !access.hasFullCourseAccess) return;
    if (isDraftLesson) return;
      await setLessonProgress(
        currentLesson.id,
        courseId,
        true,
        undefined,
        user,
      );
      progress.setProgressList((prev) => {
        const existing = prev.find(
          (progress) => progress.lesson_id === currentLesson.id,
        );
        const next = prev.filter(
          (progress) => progress.lesson_id !== currentLesson.id,
        );
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
      if (profile?.id) await invalidateLearningProgress(queryClient, profile.id, courseId);
  }});
  const markComplete = completeMutation.mutateAsync;


  if (!courseId) {
    return <LearnMissingCourseIdState translate={translate} />;
  }

  if (courseLoad.loading) {
    return <LearnLoadingState translate={translate} />;
  }

  if (courseLoad.error || !courseLoad.course || !courseLoad.course.published || courseLoad.course.archived_at) {
    return (
      <LearnErrorState
        translate={translate}
        message={courseLoad.error ?? translate("detail.notFound")}
      />
    );
  }

  if (lessonId && !rawLesson) {
    const firstLesson = visibleLessons[0] ?? null;
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-12">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-center shadow-card">
          <h1 className="text-heading-medium font-display text-foreground">
            {translate("detail.learn.lessonNotFoundTitle", { defaultValue: "Không tìm thấy bài học" })}
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            {translate("detail.learn.lessonNotFoundDescription", { defaultValue: "Bài học bạn yêu cầu không tồn tại hoặc đã bị gỡ bỏ." })}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {firstLesson && (
              <Button onClick={() => navigate(`/learn/${courseId}/lesson/${firstLesson.id}`, { replace: true })}>
                {translate("detail.learn.goToFirstLesson", { defaultValue: "Vào bài học đầu tiên" })}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(`/courses/${courseId}`)}>
              {translate("detail.learn.backToCourse")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const course = courseLoad.course;
  const hasCourseCertificate = courseHasCertificate(course);
  const hasFullCourseAccess = access.hasFullCourseAccess;
  const courseCompleted = Boolean(access.enrollment?.completed_at || completionJustSynced);
  const completionSynced = Boolean(access.enrollment?.completed_at || completionJustSynced);
  const certificateIssued = Boolean(access.enrollment?.certificate_issued_at || certificateJustIssued);
  const achievementsPath = "/achievements";

  const shouldShowFinalAssignment =
    hasFullCourseAccess && !!course.final_assignment_title;
  const shouldShowSectionQuiz =
    currentLesson?.lesson_format !== "quiz" &&
    currentLesson?.lesson_format !== "practice";

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
    hasSections: course.has_sections ?? true,
    translate,
  };

  const toggleCurriculumPanel = () => {
    const panel = curriculumPanelRef.current;
    if (!panel) {
      setCurricOpen((value) => !value);
      return;
    }

    if (panel.isCollapsed()) {
      panel.expand();
      return;
    }

    panel.collapse();
  };

  const lessonContent = (
    <>
      {courseCompleted ? (
        <CourseCompletionCertificatePanel
          className="mx-4 mb-4 sm:mx-6"
          hasCertificate={hasCourseCertificate}
          certificateIssued={certificateIssued}
          issuing={completionSyncing || certificateAutoIssuing}
          issueReason={certificateIssueReason}
          issueError={completionSyncError || certificateIssueError}
          achievementsPath={achievementsPath}
          onRetry={
            hasCourseCertificate || !completionSynced || completionSyncError
              ? () => void syncCertificate()
              : undefined
          }
        />
      ) : null}

      <LessonPlayerCard
        lesson={currentLesson}
        lessonIndex={lessonIndexForPlayer}
        isDraftLesson={!!currentLesson && isDraftLesson}
        completed={
          !!currentLesson && progress.completedIds.has(currentLesson.id)
        }
        hasFullCourseAccess={hasFullCourseAccess}
        hasFinalAssignment={shouldShowFinalAssignment}
        previousLesson={previousLesson}
        nextLesson={nextLessonInSequence}
        translate={translate}
        onMarkComplete={markComplete}
        onNavigateToLesson={(id) => navigate(`/learn/${courseId}/lesson/${id}`)}
        courseId={courseId}
      />

      {shouldShowSectionQuiz && sectionQuestions.length > 0 && currentLesson?.section_id && courseId && (
        <SectionQuiz
          key={currentLesson.section_id}
          courseId={courseId}
          sectionId={currentLesson.section_id}
          sectionTitle={
            courseLoad.sections.find((s) => s.id === currentLesson.section_id)
              ?.title ?? ""
          }
          questions={sectionQuestions}
          existingResult={sectionQuizResult}
          onResultUpdate={(existingResult) => {
            queryClient.setQueryData<SectionQuizQueryData>(
              sectionQuizOptions.queryKey,
              (current) =>
                current ? { ...current, existingResult } : current,
            );
          }}
        />
      )}

      {shouldShowFinalAssignment ? (
        <div className="px-4 pb-8 sm:px-6">
          <FinalAssignmentPanel
            courseId={courseId}
            course={course}
            profileId={profile?.id ?? ""}
            submission={submission.submission}
            submissionState={submission.state}
            onRetryLoad={() => void submission.refresh()}
            translate={translate}
            onSubmit={async (input) => {
              await submission.submit(input);
            }}
          />
        </div>
      ) : null}
      <div className="pb-8" />
    </>
  );

  const topBar = (
    <div className="relative flex h-12 shrink-0 items-center border-b border-border-subtle bg-surface-raised px-3">
      {/* Left */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCurriculumPanel}
          aria-label={translate("detail.learn.toggleCurriculum")}
          className={cn(
            "hidden xl:inline-flex",
            curricOpen &&
              "bg-primary-muted text-primary hover:bg-primary-muted hover:text-primary",
          )}
        >
          <PanelLeft className="size-4" aria-hidden />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          render={<Link to={`/courses/${courseId}`} />}
          nativeButton={false}
          aria-label={translate("detail.learn.backToCourse")}
          className="min-h-11 min-w-11"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      </div>

      {/* Center — absolutely centered */}
      <div className="absolute left-1/2 -translate-x-1/2 flex max-w-[50%] items-center gap-1.5 overflow-hidden text-sm">
        <span className="shrink-0 truncate font-medium text-foreground">
          {course.title}
        </span>
        {currentLesson && (
          <>
            <span className="shrink-0 text-foreground-subtle">/</span>
            <span className="truncate text-foreground-muted">
              {lessonText(currentLesson.title)}
            </span>
          </>
        )}
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-1">
        {/* Mobile: Sheet for curriculum */}
        <Sheet>
          <SheetTrigger
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-raised hover:text-foreground xl:hidden"
            aria-label={translate("detail.learn.openCurriculum")}
          >
            <List className="size-4" aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>
                {translate("detail.learn.curriculumTitle")}
              </SheetTitle>
            </SheetHeader>
            <LessonCurriculum variant="sidebar" {...curriculumProps} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {topBar}
      {isDesktop ? (
        <div className="flex flex-1 overflow-hidden">
          <ResizablePanelGroup
            orientation="horizontal"
            autoSaveId="learn-layout-curriculum"
          >
            <ResizablePanel
              ref={curriculumPanelRef}
              defaultSize={24}
              minSize={16}
              maxSize={35}
              collapsible
              collapsedSize={0}
              onCollapse={() => setCurricOpen(false)}
              onExpand={() => setCurricOpen(true)}
              className="flex flex-col bg-surface-base"
            >
              <LessonCurriculum variant="sidebar" {...curriculumProps} />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel
              defaultSize={76}
              minSize={40}
              className="min-w-0 bg-background"
            >
              <main className="h-full min-w-0 overflow-y-auto">
                {lessonContent}
              </main>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ) : (
        <main className="min-w-0 flex-1 overflow-y-auto">
          {lessonContent}
        </main>
      )}
    </div>
  );
}
