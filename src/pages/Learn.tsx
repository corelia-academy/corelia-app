import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  List,
  PlayCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
} from "lucide-react";
import {
  computeProgressPercent,
  getCourse,
  getEnrollment,
  getCourseLessons,
  getCourseSections,
  getCompletedLessonIds,
  getLessonProgressForCourse,
  getNextLesson,
  setLessonProgress,
  sortLessonsByCurriculum,
  touchEnrollment,
} from "@/lib/courses";
import { getSubmission, submitFinalAssignment } from "@/lib/finalAssignment";
import {
  createSePayCheckout,
  getCoursePaymentAccess,
  submitSePayCheckoutForm,
} from "@/lib/payments";
import { uploadFinalAssignmentFile } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { formatDuration, formatVndPrice, getYoutubeEmbedUrl } from "@/types/courses";
import type {
  Course,
  CourseLesson,
  CourseSection,
  LessonProgress,
} from "@/types/courses";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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
  const location = useLocation();
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [progressList, setProgressList] = useState<LessonProgress[]>([]);
  const [submission, setSubmission] = useState<Awaited<ReturnType<typeof getSubmission>>>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [paymentAccess, setPaymentAccess] = useState<Awaited<
    ReturnType<typeof getCoursePaymentAccess>
  >>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitContent, setSubmitContent] = useState("");
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [payingCertificateFee, setPayingCertificateFee] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    touchEnrollment(courseId).catch(() => {});

    Promise.all([
      getCourse(courseId),
      getCourseSections(courseId),
      getCourseLessons(courseId),
    ])
      .then(([courseRow, sectionsRow, lessonsRow]) => {
        if (cancelled) return;
        setCourse(courseRow ?? null);
        setSections(sectionsRow);
        setLessons(lessonsRow);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : translate("detail.loadCourseErrorFallback"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, translate]);

  useEffect(() => {
    if (!courseId || !profile?.id) {
      setProgressList([]);
      setPaymentAccess(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      getEnrollment(profile.id, courseId),
      getLessonProgressForCourse(profile.id, courseId),
      getCoursePaymentAccess(profile.id, courseId),
    ]).then(([enrollmentRow, progressRows, paymentRow]) => {
      if (cancelled) return;
      setEnrolled(!!enrollmentRow);
      setProgressList(progressRows);
      setPaymentAccess(paymentRow);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, profile?.id]);

  const paymentQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get("payment");
    return payment === "success" || payment === "error" || payment === "cancel"
      ? payment
      : null;
  }, [location.search]);

  useEffect(() => {
    if (!courseId || !profile?.id || !paymentQuery) return;
    let cancelled = false;

    const clearPaymentQuery = () => {
      const params = new URLSearchParams(location.search);
      params.delete("payment");
      const nextSearch = params.toString();
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
        { replace: true },
      );
    };

    if (paymentQuery === "error") {
      toast.error(translate("detail.payment.failed"));
      clearPaymentQuery();
      return;
    }

    if (paymentQuery === "cancel") {
      void (async () => {
        const latestPaymentAccess = await getCoursePaymentAccess(profile.id, courseId).catch(
          () => null,
        );
        if (cancelled) return;
        if (latestPaymentAccess) {
          setPaymentAccess(latestPaymentAccess);
        }
        if (
          latestPaymentAccess?.full_access_granted ||
          latestPaymentAccess?.certificate_fee_paid
        ) {
          clearPaymentQuery();
          return;
        }
        toast.message(translate("detail.payment.cancelled"));
        clearPaymentQuery();
      })();
      return;
    }

    toast.message(translate("detail.payment.checking"));
    void (async () => {
      const deadline = Date.now() + 20_000;
      while (!cancelled && Date.now() < deadline) {
        const pay = await getCoursePaymentAccess(profile.id, courseId).catch(() => null);
        if (cancelled) return;
        if (pay?.certificate_fee_paid || pay?.full_access_granted) {
          setPaymentAccess(pay);
          toast.success(translate("detail.payment.success", { defaultValue: translate("detail.payment.success") }));
          clearPaymentQuery();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelled) {
        toast.message(translate("detail.payment.notConfirmedYet"));
        clearPaymentQuery();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    courseId,
    location.pathname,
    location.search,
    navigate,
    paymentAccess?.certificate_fee_paid,
    paymentAccess?.full_access_granted,
    paymentQuery,
    profile?.id,
    translate,
  ]);

  useEffect(() => {
    if (!courseId || !profile?.id) return;
    let cancelled = false;
    getSubmission(profile.id, courseId).then((submissionRow) => {
      if (!cancelled) setSubmission(submissionRow);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, profile?.id]);

  const accessModel = course?.access_model ?? "free";
  const hasFullCourseAccess =
    accessModel !== "paid_upfront" ||
    enrolled ||
    !!paymentAccess?.full_access_granted ||
    profile?.role === "admin";
  const sortedLessons = useMemo(
    () => sortLessonsByCurriculum(lessons, sections),
    [lessons, sections],
  );
  const visibleLessons = useMemo(
    () =>
      hasFullCourseAccess
        ? sortedLessons
        : sortedLessons.filter((lesson) => lesson.is_preview_free),
    [hasFullCourseAccess, sortedLessons],
  );

  useEffect(() => {
    if (!courseId || visibleLessons.length === 0) return;
    const hasCurrentLesson = lessonId
      ? visibleLessons.some((lesson) => lesson.id === lessonId)
      : false;
    if (hasCurrentLesson) return;
    const next = getNextLesson(visibleLessons, progressList);
    const target = next ?? visibleLessons[0];
    if (target) {
      navigate(`/learn/${courseId}/lesson/${target.id}`, { replace: true });
    }
  }, [courseId, lessonId, navigate, progressList, visibleLessons]);

  const currentLesson = useMemo(() => {
    if (visibleLessons.length === 0 || !lessonId) return null;
    return visibleLessons.find((lesson) => lesson.id === lessonId) ?? visibleLessons[0] ?? null;
  }, [lessonId, visibleLessons]);

  const completedIds = useMemo(
    () => getCompletedLessonIds(visibleLessons, progressList),
    [progressList, visibleLessons],
  );
  const progressPercent = computeProgressPercent(visibleLessons, progressList);
  const nextLesson = getNextLesson(visibleLessons, progressList);
  const currentLessonIndex = currentLesson
    ? visibleLessons.findIndex((lesson) => lesson.id === currentLesson.id)
    : -1;
  const previousLesson =
    currentLessonIndex > 0 ? visibleLessons[currentLessonIndex - 1] : null;

  const lessonsBySection = sections.map((section) => ({
    section,
    lessons: sortedLessons.filter((lesson) => lesson.section_id === section.id),
  }));
  const visibleSectionCount = lessonsBySection.filter(
    ({ lessons: sectionLessons }) => sectionLessons.length > 0,
  ).length;

  const handleSubmitFinalAssignment = async () => {
    if (!courseId || !profile?.id || !submitContent.trim()) return;
    setSubmitting(true);
    try {
      const fileUrls: string[] = [];
      for (const file of submitFiles) {
        const uploaded = await uploadFinalAssignmentFile(courseId, profile.id, file);
        fileUrls.push(uploaded.url);
      }
      const submissionRow = await submitFinalAssignment(
        courseId,
        submitContent.trim(),
        fileUrls.length ? fileUrls : undefined,
      );
      setSubmission(submissionRow);
      setSubmitContent("");
      setSubmitFiles([]);
    } catch (e) {
      console.warn("Submit failed", e);
    } finally {
      setSubmitting(false);
    }
  };

  const markComplete = async () => {
    if (!currentLesson || !courseId || !hasFullCourseAccess) return;
    try {
      await setLessonProgress(currentLesson.id, courseId, true);
      setProgressList((prev) => {
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

  const embedUrl = currentLesson ? getYoutubeEmbedUrl(currentLesson.youtube_url) : null;
  const requiresCertificatePayment =
    course?.access_model === "free_with_paid_certificate";
  const canSubmitCertificateAssignment =
    !requiresCertificatePayment ||
    !!paymentAccess?.certificate_fee_paid ||
    profile?.role === "admin";

  const renderCurriculumList = (scrollClassName?: string) => (
    lessonsBySection.length === 0 ? (
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
        <Button size="sm" variant="outline" render={<Link to={`/courses/${courseId}`} />} nativeButton={false}>
          {translate("detail.learn.backToCourse")}
        </Button>
      </div>
    ) : (
      <div className={cn(scrollClassName)}>
        {lessonsBySection.map(({ section, lessons: sectionLessons }) => (
          <div key={section.id}>
            <div className="bg-muted/25 px-4 py-2 text-xs font-medium text-foreground">
              {section.title}
            </div>
            {sectionLessons.map((lesson) => {
              const done = completedIds.has(lesson.id);
              const active = currentLesson?.id === lesson.id;
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
                      <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
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
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success sm:mt-0" aria-hidden />
                      ) : (
                        <PlayCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block line-clamp-2 text-sm leading-5 sm:line-clamp-1",
                            active ? "font-medium text-on-primary-container" : "text-foreground",
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
    )
  );

  const handlePayCertificateFee = async () => {
    if (!courseId || !course || !profile?.id) return;
    const amount = Number(course.certificate_fee_vnd || 0);
    if (amount <= 0) {
      toast.error(translate("detail.learn.certificateFeeMissing"));
      return;
    }
    setPayingCertificateFee(true);
    try {
      const base = window.location.origin;
      const checkout = await createSePayCheckout({
        courseId,
        purpose: "certificate_fee",
        amountVnd: amount,
        successUrl: `${base}/checkout/success/certificate_fee/${courseId}`,
        errorUrl: `${base}/learn/${courseId}?payment=error`,
        cancelUrl: `${base}/learn/${courseId}?payment=cancel`,
      });
      window.sessionStorage.setItem(
        "corelia:lastCheckout",
        JSON.stringify({
          orderId: checkout.order_id,
          courseId,
          purpose: "certificate_fee",
          createdAt: Date.now(),
        }),
      );
      submitSePayCheckoutForm(checkout);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : translate("detail.learn.sepayCreateFailed"),
      );
    } finally {
      setPayingCertificateFee(false);
    }
  };

  if (!courseId) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-sm font-medium text-destructive">
            {translate("detail.missingCourseId")}
          </p>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
          <Link
            to="/courses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden /> {translate("detail.learn.backToCourses")}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-border-subtle bg-card p-8 text-center shadow-card">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm text-muted-foreground">
            {translate("detail.learn.loadingPage")}
          </p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-sm font-medium text-destructive">
            {error ?? translate("detail.notFound")}
          </p>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
          <Link
            to="/courses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden /> {translate("detail.learn.backToCourses")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {!hasFullCourseAccess ? (
        <div className="mb-4 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          {translate("detail.learn.previewModeNotice")}
        </div>
      ) : null}

      {accessModel === "paid_upfront" && enrolled && !paymentAccess?.full_access_granted ? (
        <div className="mb-4 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
          {translate("detail.accessPanel.keptAccess")}
        </div>
      ) : null}

      <Link
        to={`/courses/${courseId}`}
        className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:hidden"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {translate("detail.learn.backToCourse")}
      </Link>

      <Breadcrumb className="mb-3 hidden sm:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/courses">{translate("catalog.title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to={`/courses/${courseId}`}>{course.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {currentLesson ? currentLesson.title : translate("detail.learn.breadcrumbLearn")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <section className="mb-6 rounded-2xl border border-border-subtle bg-linear-to-br from-card via-primary-container/25 to-card p-5 shadow-elevation-2 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              {translate("detail.learn.pageEyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {course.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentLesson
                ? translate("detail.learn.lessonPosition", {
                    index: currentLessonIndex + 1,
                    total: visibleLessons.length,
                  })
                : translate("detail.learn.selectLessonToStart")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border-subtle bg-card/85 px-4 py-3 shadow-card">
              <p className="text-xs text-muted-foreground">
                {translate("detail.learn.stats.progress")}
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">{progressPercent}%</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-card/85 px-4 py-3 shadow-card">
              <p className="text-xs text-muted-foreground">
                {translate("detail.learn.stats.completedLessons")}
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {completedIds.size}/{visibleLessons.length}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-card/85 px-4 py-3 shadow-card">
              <p className="text-xs text-muted-foreground">
                {translate("detail.learn.stats.nextUp")}
              </p>
              <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">
                {nextLesson?.title ?? translate("detail.learn.completedPath")}
              </p>
            </div>
          </div>
        </div>
      </section>

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
                    lessons: visibleLessons.length,
                  })
                : translate("detail.learn.lessonList.metaPreview", {
                    open: visibleLessons.length,
                    total: sortedLessons.length,
                  })}
            </p>
            <p className="mt-1 line-clamp-1 text-sm text-foreground">
              {currentLesson?.title ?? translate("detail.learn.selectLessonToStart")}
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {progressPercent}%
            <ChevronDown className="size-3.5" aria-hidden />
          </div>
        </summary>
        <div className="border-t border-border-subtle">
          {renderCurriculumList("max-h-[60vh] overflow-y-auto")}
        </div>
      </details>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-elevation-2">
            <div className="border-b border-border-subtle bg-muted/30 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {translate("detail.learn.currentLesson.label")}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {currentLesson?.title ?? translate("detail.learn.currentLesson.selectFromList")}
                  </p>
                </div>
                {currentLesson ? (
                  <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {formatDuration(currentLesson.duration_seconds)}
                  </div>
                ) : null}
              </div>
            </div>

            {currentLesson && embedUrl ? (
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={embedUrl}
                  title={currentLesson.title}
                  className="absolute inset-0 size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-muted/50">
                <p className="text-muted-foreground">
                  {translate("detail.learn.currentLesson.selectAside")}
                </p>
              </div>
            )}

            <div className="border-t border-border-subtle p-4 sm:p-5">
              {currentLesson ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary-container px-3 py-1 text-xs font-medium text-on-primary-container">
                      {translate("detail.learn.lessonNumberBadge", { index: currentLessonIndex + 1 })}
                    </span>
                    {completedIds.has(currentLesson.id) ? (
                      <span className="rounded-md bg-success/15 px-3 py-1 text-xs font-medium text-success">
                        {translate("detail.learn.completedBadge")}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-xl font-medium text-foreground">
                    {currentLesson.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {translate("detail.learn.lessonHint")}
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center sm:w-auto"
                      onClick={() => void markComplete()}
                      disabled={completedIds.has(currentLesson.id) || !hasFullCourseAccess}
                    >
                      {completedIds.has(currentLesson.id) ? (
                        <>
                          <CheckCircle2 className="size-4" aria-hidden />{" "}
                          {translate("detail.learn.markComplete.done")}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" aria-hidden />{" "}
                          {translate("detail.learn.markComplete.action")}
                        </>
                      )}
                    </Button>
                    {previousLesson ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center sm:w-auto"
                        onClick={() => navigate(`/learn/${courseId}/lesson/${previousLesson.id}`)}
                      >
                        <ArrowLeft className="size-4" aria-hidden /> {translate("detail.learn.nav.previous")}
                      </Button>
                    ) : null}
                    {nextLesson ? (
                      <Button
                        size="sm"
                        className="w-full justify-center sm:w-auto"
                        onClick={() => navigate(`/learn/${courseId}/lesson/${nextLesson.id}`)}
                      >
                        {translate("detail.learn.nav.next")} <ArrowRight className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {!nextLesson && hasFullCourseAccess && course.final_assignment_title ? (
            <div className="mt-6 rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                <h2 className="text-lg font-medium text-foreground">
                  {course.final_assignment_title}
                </h2>
              </div>
              {course.final_assignment_description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {course.final_assignment_description}
                </p>
              ) : null}
              {course.final_assignment_instructions ? (
                <div className="mt-3 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                  <p className="whitespace-pre-wrap">{course.final_assignment_instructions}</p>
                </div>
              ) : null}

              {submission ? (
                <div className="mt-4 rounded-xl bg-muted/40 p-4">
                  <p className="text-sm font-medium text-foreground">
                    {submission.status === "approved"
                      ? translate("detail.learn.finalAssignment.status.approved")
                      : submission.status === "rejected"
                        ? translate("detail.learn.finalAssignment.status.rejected")
                        : translate("detail.learn.finalAssignment.status.pending")}
                  </p>
                  {submission.reviewer_comment ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {submission.reviewer_comment}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {requiresCertificatePayment && !submission && !canSubmitCertificateAssignment ? (
                <div className="mt-4 rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
                  {translate("detail.learn.finalAssignment.certificateFeeRequired", {
                    fee: formatVndPrice(course.certificate_fee_vnd),
                  })}
                  <div className="mt-3">
                    <Button
                      onClick={() => void handlePayCertificateFee()}
                      disabled={payingCertificateFee}
                      size="sm"
                    >
                      {payingCertificateFee
                        ? translate("detail.learn.finalAssignment.creatingPayment")
                        : translate("detail.learn.finalAssignment.payViaSePay")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {(submission?.status === "rejected" ||
                (!submission && canSubmitCertificateAssignment)) ? (
                <div className="mt-4 space-y-3">
                  <textarea
                    placeholder={translate("detail.learn.finalAssignment.contentPlaceholder")}
                    value={submitContent}
                    onChange={(e) => setSubmitContent(e.target.value)}
                    className="min-h-[140px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={6}
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      {translate("detail.learn.finalAssignment.attachmentsLabel")}
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.zip"
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-none file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                      onChange={(e) => setSubmitFiles(Array.from(e.target.files ?? []))}
                    />
                  </div>
                  <Button
                    onClick={() => void handleSubmitFinalAssignment()}
                    disabled={submitting || !submitContent.trim()}
                  >
                    {submitting
                      ? translate("detail.learn.finalAssignment.submitting")
                      : translate("detail.learn.finalAssignment.submit")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-elevation-2">
            <div className="border-b border-border-subtle bg-muted/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <List className="size-4" /> {translate("detail.learn.curriculumTitle")}
                </span>
                <span className="text-xs text-muted-foreground">{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {renderCurriculumList("max-h-[68vh] overflow-y-auto")}
          </div>
        </aside>
      </div>
    </div>
  );
}
