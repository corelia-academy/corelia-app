import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertCircle, CheckCircle2 } from "lucide-react";
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
import { LearnHeader } from "./components/LearnHeader";
import { LessonCurriculum, type CurriculumGroup } from "./components/LessonCurriculum";
import { LessonPlayerCard } from "./components/LessonPlayerCard";
import { FinalAssignmentPanel } from "./components/FinalAssignmentPanel";
import { useLearnCourseLoad } from "./hooks/useLearnCourseLoad";
import { useLearnEnrollmentAccess } from "./hooks/useLearnEnrollmentAccess";
import { useLearnPaymentReturnFlow } from "./hooks/useLearnPaymentReturnFlow";
import { useLearnProgress } from "./hooks/useLearnProgress";
import { useLearnSubmission } from "./hooks/useLearnSubmission";

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
  const { profile } = useAuth();
  const courseLoad = useLearnCourseLoad({
    courseId,
    loadCourseErrorFallback: translate("detail.loadCourseErrorFallback"),
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
  const isDraftLesson = !currentLesson?.youtube_url?.trim();

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
      await setLessonProgress(currentLesson.id, courseId, true);
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

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {!hasFullCourseAccess ? (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
          <p>{translate("detail.learn.previewModeNotice")}</p>
        </div>
      ) : null}

      {accessModel === "paid_upfront" &&
      access.enrolled &&
      !access.paymentAccess?.full_access_granted ? (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
          <p>{translate("detail.accessPanel.keptAccess")}</p>
        </div>
      ) : null}

      <LearnHeader
        courseId={courseId}
        courseTitle={course.title}
        lessonTitle={currentLesson?.title ?? null}
        translate={translate}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
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

          {shouldShowFinalAssignment ? (
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
          ) : null}
        </div>

        <LessonCurriculum
          courseId={courseId}
          groups={lessonsBySection}
          visibleSectionCount={visibleSectionCount}
          visibleLessonsCount={visibleLessons.length}
          sortedLessonsCount={sortedLessons.length}
          currentLessonTitle={currentLesson?.title ?? null}
          currentLessonId={currentLesson?.id ?? null}
          progressPercent={progress.progressPercent}
          completedIds={progress.completedIds}
          completedCount={progress.completedIds.size}
          lessonTotal={visibleLessons.length}
          nextLessonTitle={nextLesson?.title ?? null}
          hasFullCourseAccess={hasFullCourseAccess}
          translate={translate}
        />
      </div>
    </div>
  );
}
