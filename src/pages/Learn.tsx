import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  CheckCircle,
  FileText,
  LockSimple,
  List,
  PlayCircle,
  Spinner,
} from "@phosphor-icons/react";
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

export default function Learn() {
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
          setError(e instanceof Error ? e.message : "Lỗi tải khoá học");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

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
      toast.error("Thanh toán thất bại. Vui lòng thử lại.");
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
        toast.message("Bạn đã huỷ thanh toán.");
        clearPaymentQuery();
      })();
      return;
    }

    toast.message("Đang xác nhận thanh toán...");
    void (async () => {
      const deadline = Date.now() + 20_000;
      while (!cancelled && Date.now() < deadline) {
        const pay = await getCoursePaymentAccess(profile.id, courseId).catch(() => null);
        if (cancelled) return;
        if (pay?.certificate_fee_paid || pay?.full_access_granted) {
          setPaymentAccess(pay);
          toast.success("Thanh toán thành công.");
          clearPaymentQuery();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelled) {
        toast.message(
          "Chưa thấy xác nhận thanh toán. Nếu bạn đã thanh toán, vui lòng chờ thêm hoặc tải lại trang sau ít phút.",
        );
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
    <div className={cn(scrollClassName)}>
      {lessonsBySection.map(({ section, lessons: sectionLessons }) => (
        <div key={section.id}>
          <div className="bg-muted/25 px-4 py-2 text-[12px] font-medium text-foreground">
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
                    <LockSimple className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 line-clamp-2 text-[14px] leading-5 text-muted-foreground">
                      {lesson.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-warning">Khoá</span>
                  </div>
                ) : (
                  <Link
                    to={`/learn/${courseId}/lesson/${lesson.id}`}
                    className="flex items-start gap-3 sm:items-center"
                  >
                    {done ? (
                      <CheckCircle className="mt-0.5 size-4 shrink-0 text-success sm:mt-0" weight="fill" />
                    ) : (
                      <PlayCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block line-clamp-2 text-[14px] leading-5 sm:line-clamp-1",
                          active ? "font-medium text-on-primary-container" : "text-foreground",
                        )}
                      >
                        {lesson.title}
                      </span>
                      <span className="mt-1 block text-[12px] text-muted-foreground sm:hidden">
                        {formatDuration(lesson.duration_seconds)}
                      </span>
                    </div>
                    <span className="hidden shrink-0 text-[12px] text-muted-foreground sm:inline">
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
  );

  const handlePayCertificateFee = async () => {
    if (!courseId || !course || !profile?.id) return;
    const amount = Number(course.certificate_fee_vnd || 0);
    if (amount <= 0) {
      toast.error("Khoá học chưa cấu hình phí chứng nhận hợp lệ.");
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
      toast.error(e instanceof Error ? e.message : "Không tạo được thanh toán SePay.");
    } finally {
      setPayingCertificateFee(false);
    }
  };

  if (!courseId) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-[15px] font-medium text-destructive">Thiếu mã khoá học.</p>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
          <Link
            to="/courses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            <ArrowLeft className="size-4" /> Quay lại khoá học
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-border-subtle bg-card p-8 text-center shadow-card">
          <Spinner className="size-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-[15px] text-muted-foreground">
            Đang tải trang học...
          </p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-[15px] font-medium text-destructive">
            {error ?? "Không tìm thấy khoá học."}
          </p>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
          <Link
            to="/courses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            <ArrowLeft className="size-4" /> Quay lại khoá học
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {!hasFullCourseAccess ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Bạn đang ở chế độ học thử miễn phí. Chỉ các bài được đánh dấu học thử mới mở xem.
        </div>
      ) : null}

      {accessModel === "paid_upfront" && enrolled && !paymentAccess?.full_access_granted ? (
        <div className="mb-4 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
          Bạn đã ghi danh khoá học này từ trước, nên vẫn giữ quyền truy cập đầy đủ dù khoá học
          hiện đang ở chế độ trả phí.
        </div>
      ) : null}

      <Link
        to={`/courses/${courseId}`}
        className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:hidden"
      >
        <ArrowLeft className="size-4" />
        Quay lại khoá học
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
              <Link to="/courses">Khoá học</Link>
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
            <BreadcrumbPage>{currentLesson ? currentLesson.title : "Học"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <section className="mb-6 rounded-2xl border border-border-subtle bg-linear-to-br from-card via-primary-container/25 to-card p-5 shadow-elevation-2 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Trang học
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {course.title}
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {currentLesson
                ? `Bài ${currentLessonIndex + 1}/${visibleLessons.length} trong lộ trình hiện tại`
                : "Chọn một bài học để bắt đầu"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border-subtle bg-card/85 px-4 py-3 shadow-card">
              <p className="text-[12px] text-muted-foreground">Tiến độ</p>
              <p className="mt-1 text-[18px] font-medium text-foreground">{progressPercent}%</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-card/85 px-4 py-3 shadow-card">
              <p className="text-[12px] text-muted-foreground">Bài đã xong</p>
              <p className="mt-1 text-[18px] font-medium text-foreground">
                {completedIds.size}/{visibleLessons.length}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-card/85 px-4 py-3 shadow-card">
              <p className="text-[12px] text-muted-foreground">Tiếp theo</p>
              <p className="mt-1 line-clamp-1 text-[14px] font-medium text-foreground">
                {nextLesson?.title ?? "Hoàn thành lộ trình"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <details className="mb-6 overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-card lg:hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <List className="size-4" />
              Danh sách bài học
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {hasFullCourseAccess
                ? `${visibleSectionCount} chương • ${visibleLessons.length} bài`
                : `${visibleLessons.length}/${sortedLessons.length} bài đang mở`}
            </p>
            <p className="mt-1 line-clamp-1 text-[13px] text-foreground">
              {currentLesson?.title ?? "Chọn một bài học để bắt đầu"}
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
            {progressPercent}%
            <CaretDown className="size-3.5" />
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
                  <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
                    Bài học hiện tại
                  </p>
                  <p className="text-[15px] font-medium text-foreground">
                    {currentLesson?.title ?? "Chọn một bài học từ danh sách bên phải"}
                  </p>
                </div>
                {currentLesson ? (
                  <div className="rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
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
                <p className="text-muted-foreground">Chọn một bài học bên cạnh</p>
              </div>
            )}

            <div className="border-t border-border-subtle p-4 sm:p-5">
              {currentLesson ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary-container px-2.5 py-1 text-[11px] font-medium text-on-primary-container">
                      Bài {currentLessonIndex + 1}
                    </span>
                    {completedIds.has(currentLesson.id) ? (
                      <span className="rounded-md bg-success/15 px-2.5 py-1 text-[11px] font-medium text-success">
                        Đã hoàn thành
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-xl font-medium text-foreground">
                    {currentLesson.title}
                  </h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Học xong video này để tiếp tục mở tiến độ cho toàn bộ lộ trình.
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
                          <CheckCircle className="size-4" weight="fill" /> Đã hoàn thành
                        </>
                      ) : (
                        <>
                          <CheckCircle className="size-4" /> Đánh dấu đã xem
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
                        <ArrowLeft className="size-4" /> Bài trước
                      </Button>
                    ) : null}
                    {nextLesson ? (
                      <Button
                        size="sm"
                        className="w-full justify-center sm:w-auto"
                        onClick={() => navigate(`/learn/${courseId}/lesson/${nextLesson.id}`)}
                      >
                        Bài tiếp theo <ArrowRight className="size-4" />
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
                      ? "Đã duyệt — Chứng nhận sẽ được cấp."
                      : submission.status === "rejected"
                        ? "Bài bị từ chối. Bạn có thể nộp lại."
                        : "Đã nộp — Đang chờ giảng viên duyệt."}
                  </p>
                  {submission.reviewer_comment ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {submission.reviewer_comment}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {requiresCertificatePayment && !submission && !canSubmitCertificateAssignment ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  Để nộp bài thu hoạch và xét chứng nhận, học viên cần thanh toán{" "}
                  {formatVndPrice(course.certificate_fee_vnd)}.
                  <div className="mt-3">
                    <Button
                      onClick={() => void handlePayCertificateFee()}
                      disabled={payingCertificateFee}
                      size="sm"
                    >
                      {payingCertificateFee ? "Đang tạo thanh toán..." : "Thanh toán qua SePay"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {(submission?.status === "rejected" ||
                (!submission && canSubmitCertificateAssignment)) ? (
                <div className="mt-4 space-y-3">
                  <textarea
                    placeholder="Nhập nội dung bài làm của bạn..."
                    value={submitContent}
                    onChange={(e) => setSubmitContent(e.target.value)}
                    className="min-h-[140px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={6}
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      File đính kèm (tuỳ chọn)
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
                    {submitting ? "Đang nộp..." : "Nộp bài"}
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
                <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <List className="size-4" /> Curriculum
                </span>
                <span className="text-[12px] text-muted-foreground">{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-success transition-all"
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
