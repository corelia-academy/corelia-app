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
  AlertCircle,
  CheckCircle2,
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
  isLessonPublishedForLearners,
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
import { getSectionQuestions } from "@/lib/sectionQuestions";
import { getSectionQuizResult } from "@/lib/quizAttempts";
import type { SectionQuestion, SectionQuizResult } from "@/types/questions";
import { useLearnCourseLoad } from "./hooks/useLearnCourseLoad";
import { useLearnEnrollmentAccess } from "./hooks/useLearnEnrollmentAccess";
import { useLearnPaymentReturnFlow } from "./hooks/useLearnPaymentReturnFlow";
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
  const [sectionQuestions, setSectionQuestions] = useState<SectionQuestion[]>(
    [],
  );
  const [sectionQuizResult, setSectionQuizResult] =
    useState<SectionQuizResult | null>(null);

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

  const syncCertificate = useCallback(async () => {
    const course = courseLoad.course;
    if (!courseId || !profile?.id || !course) return null;
    let phase: "completion" | "certificate" = "completion";
    setCertificateIssueReason(null);
    setCertificateIssueError(null);
    try {
      const enrollment = await ensureEnrollmentForProgress(
        profile.id,
        courseId,
        new Date().toISOString(),
      );
      if (enrollment) access.setEnrollment(enrollment);
      setCompletionSyncing(true);
      setCompletionSyncError(null);
      const completion = await syncCourseCompletion(profile.id, courseId);
      let baseEnrollment = enrollment ?? access.enrollment;
      if (completion.completed) {
        const completedAt = completion.completed_at || baseEnrollment?.completed_at || new Date().toISOString();
        if (baseEnrollment) {
          baseEnrollment = { ...baseEnrollment, completed_at: completedAt };
          access.setEnrollment(baseEnrollment);
        }
        setCompletionJustSynced(true);
      } else {
        setCompletionSyncError(
          completion.message || translate("detail.learn.completion.completionSyncFailed"),
        );
        return null;
      }
      setCompletionSyncing(false);
      const credentialCheck = await invokeCheckCourseCredential(courseId, undefined, {
        autoIssue: true,
      });
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
      phase = "certificate";
      setCertificateAutoIssuing(true);
      const result = await checkAndIssueCertificate(profile.id, courseId);
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
      setCompletionSyncing(false);
      setCertificateAutoIssuing(false);
    }
  }, [
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
    if (access.enrollment?.completed_at && (!courseHasCertificate(course) || access.enrollment.certificate_issued_at)) {
      return;
    }
    const key = `${profile.id}:${courseId}`;
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
  ]);

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
  const isDraftLesson = currentLesson
    ? isLessonDraftForLearners(currentLesson)
    : false;

  useEffect(() => {
    if (!courseId || !lessonId || !currentLesson) return;
    if (!isDraftLesson) return;
    if (isPrivilegedViewer) return;

    const fallback = visibleLessons.find((l) =>
      isLessonPublishedForLearners(l),
    );
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

  // Load quiz questions and existing result whenever the current lesson (and its section) changes
  useEffect(() => {
    if (!courseId || !currentLesson?.section_id) {
      queueMicrotask(() => {
        setSectionQuestions([]);
        setSectionQuizResult(null);
      });
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
        return getSectionQuizResult(courseId, sectionId, questions.length).then(
          (result) => {
            if (!cancelled) setSectionQuizResult(result);
          },
        );
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
  const nextLessonInSequence =
    currentLessonIndex >= 0 && currentLessonIndex < visibleLessons.length - 1
      ? visibleLessons[currentLessonIndex + 1]
      : null;

  const lessonIndexForPlayer = currentLesson ? currentLessonIndex : null;

  const lessonsBySection = useMemo<CurriculumGroup[]>(
    () =>
      courseLoad.sections.map((section) => ({
        section,
        lessons: sortedLessons.filter(
          (lesson) => lesson.section_id === section.id,
        ),
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
  const hasCourseCertificate = courseHasCertificate(course);
  const hasFullCourseAccess = access.hasFullCourseAccess;
  const courseCompleted = progress.progressPercent >= 100 && visibleLessons.length > 0;
  const completionSynced = Boolean(access.enrollment?.completed_at || completionJustSynced);
  const certificateIssued = Boolean(access.enrollment?.certificate_issued_at || certificateJustIssued);
  const achievementsPath = "/achievements";

  const shouldShowFinalAssignment =
    !nextLesson && hasFullCourseAccess && !!course.final_assignment_title;
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
        previousLesson={previousLesson}
        nextLesson={nextLessonInSequence}
        translate={translate}
        onMarkComplete={() => void markComplete()}
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
              {currentLesson.title}
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
