import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/stores/authStore";
import { sortLessonsByCurriculum } from "@/lib/courses";
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
import { useCoraStore } from "@/stores/coraStore";

export default function CourseDetail() {
  const { t } = useTranslation("courses");
  const translate = useMemo(
    () => (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const setSidebarMeta = useCoraStore((s) => s.setSidebarMeta);
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

  usePaymentReturnFlow({
    resolvedCourseId: courseLoad.resolvedCourseId,
    profileId: profile?.id,
    paymentAccessFullAccessGranted: access.paymentAccess?.full_access_granted,
    setPaymentAccess: access.setPaymentAccess,
    setEnrolled: access.setEnrolled,
    setEnrollment: access.setEnrollment,
    translate,
  });

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
        lessons: sortedLessons.filter(
          (lesson) => lesson.section_id === section.id,
        ),
      })),
    [courseLoad.sections, sortedLessons],
  );
  const visibleLessonGroups = lessonsBySection.filter(
    ({ lessons: sectionLessons }) => sectionLessons.length > 0,
  );

  const isPreviewOnlyCurriculum = isPaidUpfront && !hasFullCourseAccess;
  const curriculumCountLabel = isPreviewOnlyCurriculum
    ? translate("detail.courseDetail.lessonCountPreview", {
        count: lessons.length,
      })
    : translate("detail.courseDetail.lessonCount", { count: lessons.length });

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
      />

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
          />

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
