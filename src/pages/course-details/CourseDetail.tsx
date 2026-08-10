import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/stores/authStore";
import {
  checkAndIssueCertificate,
  courseHasCertificate,
  ensureEnrollmentForProgress,
  sortLessonsByCurriculum,
  syncCourseCompletion,
} from "@/lib/courses";
import { invokeCheckCourseCredential } from "@/lib/credentialsEdge";
import { getDetailedLessonCounts } from "@/lib/lessonFormat";
import { useCourseLoad } from "./hooks/useCourseLoad";
import { useCourseLessons } from "./hooks/useCourseLessons";
import { useCourseEnrollmentAccess } from "./hooks/useCourseEnrollmentAccess";
import { useCourseProgress } from "./hooks/useCourseProgress";
import { useSpotlightContests } from "./hooks/useSpotlightContests";
import { usePaymentReturnFlow } from "./hooks/usePaymentReturnFlow";
import { computePricing } from "./utils/pricing";
import {
  CourseDetailError,
  CourseDetailLoading,
} from "./components/CourseDetailStates";
import { CourseDraftBanner } from "./components/CourseDraftBanner";
import { CourseHero } from "./components/CourseHero";
import { CourseLearningOutcomes } from "./components/CourseLearningOutcomes";
import { CourseDescription } from "./components/CourseDescription";
import {
  CourseCurriculum,
  type CurriculumGroup,
} from "./components/CourseCurriculum";
import { CourseAccessPanel } from "./components/CourseAccessPanel";
import { CourseSpotlightSection } from "./components/CourseSpotlightSection";
import { CourseLanguagePanel } from "./components/CourseLanguagePanel";
import { CoursePartnerBrandPanel } from "./components/CoursePartnerBrandPanel";
import { CourseSponsorsPanel } from "./components/CourseSponsorsPanel";
import { CourseInstructorSection } from "./components/CourseInstructorSection";
import { useInstructorProfile } from "./hooks/useInstructorProfile";
import { useCoraStore } from "@/stores/coraStore";
import { usePageMeta } from "@/hooks/usePageMeta";
import { FollowerPreview } from "@/components/social/FollowerPreview";
import { CourseCompletionCertificatePanel } from "@/components/courses/CourseCompletionCertificatePanel";
import type { CertificateIssueReason } from "@/lib/courses";

export default function CourseDetail() {
  const { t } = useTranslation("courses");
  const translate = useMemo(
    () => (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const setSidebarMeta = useCoraStore((s) => s.setSidebarMeta);
  const completionSyncAttemptedRef = useRef<Set<string>>(new Set());
  const [completionSyncing, setCompletionSyncing] = useState(false);
  const [completionJustSynced, setCompletionJustSynced] = useState(false);
  const [completionSyncError, setCompletionSyncError] = useState<string | null>(null);
  const [certificateIssuing, setCertificateIssuing] = useState(false);
  const [certificateJustIssued, setCertificateJustIssued] = useState(false);
  const [certificateIssueReason, setCertificateIssueReason] =
    useState<CertificateIssueReason | null>(null);
  const [certificateIssueError, setCertificateIssueError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user, isAuthenticated } = useAuth();

  const courseLoad = useCourseLoad({
    idOrSlug: id,
    missingIdMessage: translate("detail.missingCourseId"),
    loadCourseErrorFallback: translate("detail.loadCourseErrorFallback"),
    viewer: user,
  });

  const access = useCourseEnrollmentAccess({
    resolvedCourseId: courseLoad.resolvedCourseId,
    profileId: profile?.id,
    viewer: user,
  });

  const accessModelEffective = courseLoad.course?.access_model ?? "free";
  const isPaidUpfront = accessModelEffective === "paid_upfront";
  const isFreeWithPaidCertificate =
    accessModelEffective === "free_with_paid_certificate";
  const hasFullCourseAccess =
    !isPaidUpfront ||
    access.enrolled ||
    !!access.paymentAccess?.full_access_granted;
  const previewOnly = isPaidUpfront && !hasFullCourseAccess;

  const loadLessonsErrorFallback = translate(
    "detail.loadLessonsErrorFallback",
  );

  const lessons = useCourseLessons({
    resolvedCourseId: courseLoad.resolvedCourseId,
    course: courseLoad.course,
    previewOnly,
    onError: courseLoad.setError,
    loadLessonsErrorFallback,
  });

  const progress = useCourseProgress({
    resolvedCourseId: courseLoad.resolvedCourseId,
    profileId: profile?.id,
    lessons,
    sections: courseLoad.sections,
  });

  const spotlightContests = useSpotlightContests();
  const { profile: instructorProfile } = useInstructorProfile(courseLoad.course?.instructor_id);

  usePaymentReturnFlow({
    resolvedCourseId: courseLoad.resolvedCourseId,
    profileId: profile?.id,
    paymentAccessFullAccessGranted: access.paymentAccess?.full_access_granted,
    setPaymentAccess: access.setPaymentAccess,
    setEnrolled: access.setEnrolled,
    setEnrollment: access.setEnrollment,
    translate,
  });

  const syncCertificate = useCallback(async () => {
    const course = courseLoad.course;
    const courseId = courseLoad.resolvedCourseId;
    if (!course || !courseId || !profile?.id || !isAuthenticated) {
      return null;
    }
    let phase: "completion" | "certificate" = "completion";
    setCertificateIssueReason(null);
    setCertificateIssueError(null);
    try {
      const enrollment = await ensureEnrollmentForProgress(
        profile.id,
        courseId,
        new Date().toISOString(),
      );
      if (enrollment) {
        access.setEnrolled(true);
        access.setEnrollment(enrollment);
      }
      setCompletionSyncing(true);
      setCompletionSyncError(null);
      const completion = await syncCourseCompletion(profile.id, courseId);
      let baseEnrollment = enrollment ?? access.enrollment;
      if (completion.completed) {
        const completedAt = completion.completed_at || baseEnrollment?.completed_at || new Date().toISOString();
        if (baseEnrollment) {
          baseEnrollment = { ...baseEnrollment, completed_at: completedAt };
          access.setEnrolled(true);
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
      setCertificateIssuing(true);
      const result = await checkAndIssueCertificate(profile.id, courseId);
      setCertificateIssueReason(result.reason);
      if (result.issued) {
        const issuedAt = result.certificate_issued_at || new Date().toISOString();
        if (baseEnrollment) {
          access.setEnrolled(true);
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
      console.warn("[course-detail] certificate sync failed", {
        userId: profile.id,
        courseId,
        error: message,
      });
      return null;
    } finally {
      setCompletionSyncing(false);
      setCertificateIssuing(false);
    }
  }, [
    access,
    courseLoad.course,
    courseLoad.resolvedCourseId,
    isAuthenticated,
    profile?.id,
    progress,
    navigate,
    translate,
  ]);

  useEffect(() => {
    const course = courseLoad.course;
    const courseId = courseLoad.resolvedCourseId;
    if (!course || !courseId || !profile?.id || !isAuthenticated) return;
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
    courseLoad.course,
    courseLoad.resolvedCourseId,
    isAuthenticated,
    profile?.id,
    progress.progressPercent,
    syncCertificate,
  ]);

  const sortedLessons = useMemo(
    () => sortLessonsByCurriculum(lessons, courseLoad.sections),
    [lessons, courseLoad.sections],
  );
  const previewLessons = useMemo(
    () => sortedLessons.filter((lesson) => lesson.is_preview_free),
    [sortedLessons],
  );

  const lessonsBySection = useMemo<CurriculumGroup[]>(
    () =>
      courseLoad.sections.map((section) => ({
        section,
        lessons: sortedLessons.filter((lesson) => lesson.section_id === section.id),
      })),
    [courseLoad.sections, sortedLessons],
  );
  const visibleLessonGroups = lessonsBySection.filter(
    ({ lessons: sectionLessons }) => sectionLessons.length > 0,
  );

  const isPreviewOnlyCurriculum = isPaidUpfront && !hasFullCourseAccess;
  const targetLessons = isPreviewOnlyCurriculum ? previewLessons : lessons;
  const detailedCounts = getDetailedLessonCounts(targetLessons);
  const contentCount = detailedCounts.videoCount + detailedCounts.articleCount;

  let curriculumCountLabel: string;
  if (isPreviewOnlyCurriculum) {
    curriculumCountLabel = translate("detail.courseDetail.lessonCountPreview", {
      count: contentCount > 0 ? contentCount : detailedCounts.totalCount,
    });
  } else if (contentCount > 0) {
    curriculumCountLabel = translate("detail.courseDetail.lessonCount", {
      count: contentCount,
    });
  } else if (detailedCounts.quizCount > 0 && detailedCounts.quizCount === detailedCounts.totalCount) {
    curriculumCountLabel = translate("detail.courseDetail.breakdown.quiz", {
      count: detailedCounts.quizCount,
    });
  } else if (detailedCounts.practiceCount > 0 && detailedCounts.practiceCount === detailedCounts.totalCount) {
    curriculumCountLabel = translate("detail.courseDetail.breakdown.practice", {
      count: detailedCounts.practiceCount,
    });
  } else if (detailedCounts.totalCount > 0) {
    curriculumCountLabel = translate("detail.courseDetail.breakdown.quiz", {
      count: detailedCounts.totalCount,
    });
  } else {
    curriculumCountLabel = translate("detail.courseDetail.lessonCount", {
      count: 0,
    });
  }

  const canReviewDraft =
    courseLoad.course &&
    !courseLoad.course.published &&
    profile &&
    (profile.role === "admin" ||
      (profile.role === "instructor" &&
        courseLoad.course.instructor_id === profile.id));

  useEffect(() => {
    const title = courseLoad.course?.title;
    if (!title) return;
    setSidebarMeta({ courseTitle: title, courseId: courseLoad.resolvedCourseId ?? null });
    return () => setSidebarMeta(null);
  }, [courseLoad.course?.title, courseLoad.resolvedCourseId, setSidebarMeta]);

  usePageMeta({
    title: courseLoad.course?.title ?? undefined,
    description: courseLoad.course?.description ?? undefined,
    image: courseLoad.course?.thumbnail_url ?? undefined,
    url: window.location.href,
  });

  const totalDurationFromLessons = lessons.reduce(
    (sum, lesson) => sum + (Number(lesson.duration_seconds) || 0),
    0,
  );
  const storedTotal = Number(courseLoad.course?.total_duration_seconds) || 0;
  const displayTotalDuration =
    storedTotal > 0 ? storedTotal : totalDurationFromLessons;

  const pricing = useMemo(
    () => computePricing(courseLoad.course),
    [courseLoad.course],
  );
  const courseCompleted = progress.progressPercent >= 100 && sortedLessons.length > 0;
  const hasCourseCertificate = courseHasCertificate(courseLoad.course);
  const completionSynced = Boolean(access.enrollment?.completed_at || completionJustSynced);
  const certificateIssued = Boolean(
    access.enrollment?.certificate_issued_at || certificateJustIssued,
  );
  const achievementsPath = "/achievements";

  const handleEnroll = useCallback(async () => {
    const courseId = courseLoad.resolvedCourseId;
    if (!courseId) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (!profile?.id) return;
    try {
      await access.runEnroll();
      const result = await progress.refresh();
      const sorted = result?.sorted ?? sortedLessons;
      const next = result?.next ?? sorted[0] ?? null;
      if (next) navigate(`/learn/${courseId}/lesson/${next.id}`);
      else if (sorted[0])
        navigate(`/learn/${courseId}/lesson/${sorted[0].id}`);
      else navigate(`/learn/${courseId}`);
    } catch (e) {
      courseLoad.setError(
        e instanceof Error
          ? e.message
          : translate("detail.enrollErrorFallback"),
      );
    }
  }, [
    access,
    courseLoad,
    isAuthenticated,
    location,
    navigate,
    profile?.id,
    progress,
    sortedLessons,
    translate,
  ]);

  const handleStartPreview = useCallback(() => {
    const courseId = courseLoad.resolvedCourseId;
    if (!courseId) return;
    const previewTarget = previewLessons[0];
    if (previewTarget) {
      navigate(`/learn/${courseId}/lesson/${previewTarget.id}`);
      return;
    }
    navigate(`/learn/${courseId}`);
  }, [courseLoad.resolvedCourseId, navigate, previewLessons]);

  const handleContinue = useCallback(() => {
    const courseId = courseLoad.resolvedCourseId;
    if (!courseId) return;
    navigate(
      progress.nextLesson
        ? `/learn/${courseId}/lesson/${progress.nextLesson.id}`
        : `/learn/${courseId}`,
    );
  }, [courseLoad.resolvedCourseId, navigate, progress.nextLesson]);

  const handleBuy = useCallback(() => {
    const courseId = courseLoad.resolvedCourseId;
    if (!courseId) return;
    navigate(`/checkout/course/${courseId}`);
  }, [courseLoad.resolvedCourseId, navigate]);

  const handleEnrollClick = useCallback(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    void handleEnroll();
  }, [handleEnroll, isAuthenticated, location, navigate]);

  if (courseLoad.loading) return <CourseDetailLoading />;
  if (courseLoad.error || !courseLoad.course)
    return <CourseDetailError message={courseLoad.error} />;

  const course = courseLoad.course;

  return (
    <div className="container-app py-6 sm:py-8">
      {canReviewDraft ? (
        <CourseDraftBanner
          courseId={courseLoad.resolvedCourseId ?? id ?? ""}
        />
      ) : null}

      <CourseHero
        course={course}
        enrollment={access.enrollment}
        isPaidUpfront={isPaidUpfront}
        isFreeWithPaidCertificate={isFreeWithPaidCertificate}
        previewLessons={previewLessons}
        displayTotalDuration={displayTotalDuration}
        curriculumCountLabel={curriculumCountLabel}
        progressPercent={progress.progressPercent}
        onCertificateClaimed={(issuedAt) =>
          access.setEnrollment(
            access.enrollment ? { ...access.enrollment, certificate_issued_at: issuedAt } : null,
          )
        }
      />

      {courseCompleted ? (
        <CourseCompletionCertificatePanel
          className="mt-4"
          hasCertificate={hasCourseCertificate}
          certificateIssued={certificateIssued}
          issuing={completionSyncing || certificateIssuing}
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

      {course.published && courseLoad.resolvedCourseId ? (
        <div className="mt-4 flex flex-col items-end gap-2">
          <FollowerPreview
            subject={{ type: "course", id: courseLoad.resolvedCourseId }}
            totalCount={course.follower_count ?? 0}
          />
        </div>
      ) : null}

      <div className="mt-6 space-y-4 lg:hidden">
        <CourseAccessPanel
          course={course}
          resolvedCourseId={courseLoad.resolvedCourseId}
          hasFullCourseAccess={hasFullCourseAccess}
          isPaidUpfront={isPaidUpfront}
          isFreeWithPaidCertificate={isFreeWithPaidCertificate}
          enrolled={access.enrolled}
          paymentAccess={access.paymentAccess}
          progressPercent={progress.progressPercent}
          hasStarted={progress.hasStarted}
          nextLesson={progress.nextLesson}
          pricing={pricing}
          previewLessons={previewLessons}
          isAuthenticated={isAuthenticated}
          enrolling={access.enrolling}
          onContinue={handleContinue}
          onBuy={handleBuy}
          onStartPreview={handleStartPreview}
          onEnroll={handleEnrollClick}
        />
        <CourseLanguagePanel course={course} lessons={lessons} />
        <CoursePartnerBrandPanel course={course} />
        <CourseSponsorsPanel sponsors={course.sponsors} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
        <main className="min-w-0">
          <CourseLearningOutcomes outcomes={course.learning_outcomes ?? []} />

          <CourseDescription
            description={course.description ?? ""}
            isExternalAggregated={course.is_external_aggregated}
            externalSourceUrls={course.external_source_urls}
            externalSourceAttributionNote={course.external_source_attribution_note}
          />

          <CourseCurriculum
            visibleLessonGroups={visibleLessonGroups}
            isPaidUpfront={isPaidUpfront}
            isPreviewOnlyCurriculum={isPreviewOnlyCurriculum}
            hasSections={courseLoad.course?.has_sections ?? true}
          />

          {instructorProfile ? (
            <CourseInstructorSection
              profile={instructorProfile}
              coInstructors={course.co_instructors ?? []}
            />
          ) : null}

          <CourseSpotlightSection
            resolvedCourseId={courseLoad.resolvedCourseId ?? ""}
            courseTitle={course.title ?? ""}
            hasFullCourseAccess={hasFullCourseAccess}
            nextLesson={progress.nextLesson}
            spotlightContests={spotlightContests}
          />
        </main>

        <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <CourseAccessPanel
            course={course}
            resolvedCourseId={courseLoad.resolvedCourseId}
            hasFullCourseAccess={hasFullCourseAccess}
            isPaidUpfront={isPaidUpfront}
            isFreeWithPaidCertificate={isFreeWithPaidCertificate}
            enrolled={access.enrolled}
            paymentAccess={access.paymentAccess}
            progressPercent={progress.progressPercent}
            hasStarted={progress.hasStarted}
            nextLesson={progress.nextLesson}
            pricing={pricing}
            previewLessons={previewLessons}
            isAuthenticated={isAuthenticated}
            enrolling={access.enrolling}
            onContinue={handleContinue}
            onBuy={handleBuy}
            onStartPreview={handleStartPreview}
            onEnroll={handleEnrollClick}
          />
          <CourseLanguagePanel course={course} lessons={lessons} />
          <CoursePartnerBrandPanel course={course} />
          <CourseSponsorsPanel sponsors={course.sponsors} />
        </aside>
      </div>
    </div>
  );
}
