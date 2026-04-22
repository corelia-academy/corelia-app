import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CaretDown,
  Eye,
  PencilSimple,
  RocketLaunch,
  Spinner,
  Trophy,
} from "@phosphor-icons/react";
import { CoreliaSpotlight } from "@/components/spotlight/CoreliaSpotlight";
import {
  computeProgressPercent,
  enrollCourse,
  getCourse,
  getCourseBySlug,
  getCourseLessons,
  getCourseSections,
  getEnrollment,
  getLessonProgressForCourse,
  getNextLesson,
  sortLessonsByCurriculum,
} from "@/lib/courses";
import { listContests } from "@/lib/contests";
import { getCoursePaymentAccess } from "@/lib/payments";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatVndPrice,
  getCourseAccessModelLabel,
  getCourseLevelLabel,
} from "@/types/courses";
import { intlLocale } from "@/lib/intl";
import type { Contest } from "@/types/contests";
import type { Course, CourseLesson, CourseSection } from "@/types/courses";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function CourseDetail() {
  const { t } = useTranslation("courses");
  const translate = useMemo(
    () => (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAuthenticated } = useAuth();
  const [resolvedCourseId, setResolvedCourseId] = useState<string | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState<{
    certificate_issued_at?: string | null;
  } | null>(null);
  const [paymentAccess, setPaymentAccess] = useState<{
    full_access_granted?: boolean;
    certificate_fee_paid?: boolean;
  } | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [nextLesson, setNextLesson] = useState<CourseLesson | null>(null);
  const [spotlightContests, setSpotlightContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError(translate("detail.missingCourseId"));
      return;
    }
    let cancelled = false;

    void (async () => {
      const bySlug = await getCourseBySlug(id).catch(() => null);
      const byId = bySlug ? null : await getCourse(id).catch(() => null);
      const courseRow = bySlug ?? byId;
      const sectionsRow = courseRow ? await getCourseSections(courseRow.id) : [];

      if (cancelled) return;
      setCourse(courseRow ?? null);
      setResolvedCourseId(courseRow?.id ?? null);
      setSections(sectionsRow);
      if (courseRow?.slug && id !== courseRow.slug) {
        navigate(`/courses/${courseRow.slug}`, { replace: true });
      }
    })()
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
  }, [id, navigate, translate]);

  useEffect(() => {
    if (!resolvedCourseId || !course) return;
    let cancelled = false;
    const previewOnly =
      course.access_model === "paid_upfront" &&
      !paymentAccess?.full_access_granted &&
      !enrolled;

    getCourseLessons(resolvedCourseId, { previewOnly })
      .then((rows) => {
        if (!cancelled) setLessons(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : translate("detail.loadLessonsErrorFallback"),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedCourseId, course, enrolled, paymentAccess?.full_access_granted, translate]);

  useEffect(() => {
    if (!resolvedCourseId || !profile?.id) {
      setEnrolled(false);
      setEnrollment(null);
      setPaymentAccess(null);
      setProgressPercent(0);
      setNextLesson(null);
      return;
    }
    let cancelled = false;

    Promise.all([
      getEnrollment(profile.id, resolvedCourseId),
      getCoursePaymentAccess(profile.id, resolvedCourseId),
    ])
      .then(([enrollmentRow, paymentRow]) => {
        if (cancelled) return;
        setEnrolled(!!enrollmentRow);
        setEnrollment(enrollmentRow ?? null);
        setPaymentAccess(paymentRow ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setEnrolled(false);
        setEnrollment(null);
        setPaymentAccess(null);
      });

    getLessonProgressForCourse(profile.id, resolvedCourseId)
      .then((list) => {
        if (cancelled) return;
        const sorted = sortLessonsByCurriculum(lessons, sections);
        setProgressPercent(computeProgressPercent(sorted, list));
        setNextLesson(getNextLesson(sorted, list));
      })
      .catch(() => {
        if (cancelled) return;
        setProgressPercent(0);
        setNextLesson(null);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedCourseId, lessons, profile?.id, sections]);

  useEffect(() => {
    let cancelled = false;

    listContests()
      .catch(() => [] as Contest[])
      .then((contestRows) => {
      if (cancelled) return;
      setSpotlightContests(
        contestRows.filter((item) => item.status === "published" || item.status === "running"),
      );
      });

    return () => {
      cancelled = true;
    };
  }, [translate]);

  const paymentQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get("payment");
    return payment === "success" || payment === "error" || payment === "cancel"
      ? payment
      : null;
  }, [location.search]);

  useEffect(() => {
    if (!resolvedCourseId || !profile?.id || !paymentQuery) return;
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
        const latestPaymentAccess = await getCoursePaymentAccess(profile.id, resolvedCourseId).catch(() => null);
        const latestEnrollment = await getEnrollment(profile.id, resolvedCourseId).catch(() => null);
        if (cancelled) return;
        if (latestPaymentAccess) {
          setPaymentAccess(latestPaymentAccess);
        }
        if (latestEnrollment) {
          setEnrolled(true);
          setEnrollment(latestEnrollment);
        }
        if (latestPaymentAccess?.full_access_granted || !!latestEnrollment) {
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
        const pay = await getCoursePaymentAccess(profile.id, resolvedCourseId).catch(() => null);
        if (cancelled) return;
        if (pay?.full_access_granted) {
          setPaymentAccess(pay);
          toast.success(translate("detail.payment.success"));
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
    resolvedCourseId,
    location.pathname,
    location.search,
    navigate,
    paymentAccess?.full_access_granted,
    paymentQuery,
    profile?.id,
    translate,
  ]);

  const handleEnroll = async () => {
    if (!resolvedCourseId) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (!profile?.id) return;
    setEnrolling(true);
    try {
      const enrollmentRow = await enrollCourse(resolvedCourseId);
      setEnrolled(true);
      setEnrollment(enrollmentRow);
      const list = await getLessonProgressForCourse(profile.id, resolvedCourseId);
      const sorted = sortLessonsByCurriculum(lessons, sections);
      const next = getNextLesson(sorted, list) ?? sorted[0];
      setNextLesson(next ?? null);
      setProgressPercent(computeProgressPercent(sorted, list));
      if (next) navigate(`/learn/${resolvedCourseId}/lesson/${next.id}`);
      else if (sorted[0]) navigate(`/learn/${resolvedCourseId}/lesson/${sorted[0].id}`);
      else navigate(`/learn/${resolvedCourseId}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : translate("detail.enrollErrorFallback"),
      );
    } finally {
      setEnrolling(false);
    }
  };

  const sortedLessons = useMemo(
    () => sortLessonsByCurriculum(lessons, sections),
    [lessons, sections],
  );
  const previewLessons = useMemo(
    () => sortedLessons.filter((lesson) => lesson.is_preview_free),
    [sortedLessons],
  );
  const accessModel = course?.access_model ?? "free";
  const isPaidUpfront = accessModel === "paid_upfront";
  const isFreeWithPaidCertificate = accessModel === "free_with_paid_certificate";
  const hasFullCourseAccess =
    accessModel !== "paid_upfront" || enrolled || !!paymentAccess?.full_access_granted;

  const handleStartPreview = () => {
    if (!resolvedCourseId) return;
    const previewTarget = previewLessons[0];
    if (previewTarget) {
      navigate(`/learn/${resolvedCourseId}/lesson/${previewTarget.id}`);
      return;
    }
    navigate(`/learn/${resolvedCourseId}`);
  };

  const lessonsBySection = useMemo(
    () =>
      sections.map((section) => ({
        section,
        lessons: sortedLessons.filter((lesson) => lesson.section_id === section.id),
      })),
    [sections, sortedLessons],
  );
  const visibleLessonGroups = lessonsBySection.filter(
    ({ lessons: sectionLessons }) => sectionLessons.length > 0,
  );
  const isPreviewOnlyCurriculum =
    isPaidUpfront && !hasFullCourseAccess;
  const curriculumCountLabel = isPreviewOnlyCurriculum
    ? `${lessons.length} bài học thử`
    : `${lessons.length} bài học`;

  const canReviewDraft =
    course &&
    !course.published &&
    profile &&
    (profile.role === "admin" ||
      (profile.role === "instructor" && course.instructor_id === profile.id));

  const totalDurationFromLessons = lessons.reduce(
    (sum, lesson) => sum + (Number(lesson.duration_seconds) || 0),
    0,
  );
  const storedTotal = Number(course?.total_duration_seconds) || 0;
  const displayTotalDuration = storedTotal > 0 ? storedTotal : totalDurationFromLessons;

  const pricing = useMemo(() => {
    const base = Number(course?.price_vnd || 0);
    const promo = Number(course?.promo_price_vnd || 0);
    const endsAt = course?.promo_ends_at ? Date.parse(course.promo_ends_at) : NaN;
    const promoActive =
      promo > 0 &&
      promo < base &&
      (!Number.isFinite(endsAt) || Date.now() <= endsAt);
    return {
      base,
      promo,
      promoActive,
      endsAt,
      display: promoActive ? promo : base,
    };
  }, [course?.price_vnd, course?.promo_ends_at, course?.promo_price_vnd]);
  const courseIdForSpotlight = resolvedCourseId ?? "";
  const courseTitle = course?.title ?? "";

  const courseSpotlightItems = useMemo(() => {
    const items: {
      id: string;
      badge: string;
      title: string;
      description: string;
      href: string;
      ctaLabel: string;
      meta?: string;
      icon?: React.ReactNode;
      accent?: "amber" | "emerald" | "sky";
    }[] = [];

    if (hasFullCourseAccess) {
      items.push({
        id: `learn-${courseIdForSpotlight}`,
        badge: translate("detail.spotlight.myCourseBadge"),
        title: nextLesson
          ? translate("detail.spotlight.resumeTitle")
          : translate("detail.spotlight.enterSpaceTitle"),
        description: nextLesson
          ? translate("detail.spotlight.resumeDescription", { courseTitle })
          : translate("detail.spotlight.enterSpaceDescription", { courseTitle }),
        href: nextLesson
          ? `/learn/${courseIdForSpotlight}/lesson/${nextLesson.id}`
          : `/learn/${courseIdForSpotlight}`,
        ctaLabel: nextLesson
          ? translate("detail.spotlight.continueLearning")
          : translate("detail.spotlight.enterLearningPage"),
        meta: nextLesson
          ? translate("detail.spotlight.nextLessonMeta", { title: nextLesson.title })
          : translate("detail.spotlight.progressEverywhereMeta"),
        icon: <RocketLaunch className="size-5" weight="duotone" />,
        accent: "sky",
      });
    }

    const liveContest = spotlightContests[0];
    if (liveContest) {
      items.push({
        id: `contest-${liveContest.id}`,
        badge:
          liveContest.status === "running"
            ? translate("detail.spotlight.runningContestBadge")
            : translate("detail.spotlight.newContestBadge"),
        title: liveContest.title,
        description: liveContest.tagline,
        href: `/contests/${liveContest.id}`,
        ctaLabel: translate("detail.spotlight.exploreContest"),
        meta:
          liveContest.registration_deadline != null
            ? `Hạn đăng ký: ${new Date(liveContest.registration_deadline).toLocaleDateString(intlLocale())}`
            : translate("detail.spotlight.contestMetaNoDeadline"),
        icon: <Trophy className="size-5" weight="duotone" />,
        accent: "amber",
      });
    }

    if (items.length < 2) {
      items.push({
        id: "courses-library",
        badge: translate("detail.spotlight.exploreMoreBadge"),
        title: translate("detail.spotlight.exploreMoreTitle"),
        description: translate("detail.spotlight.exploreMoreDescription"),
        href: "/courses",
        ctaLabel: translate("detail.spotlight.seeMoreCourses"),
        meta: translate("detail.spotlight.ecosystemMeta"),
        icon: <BookOpen className="size-5" weight="duotone" />,
        accent: "sky",
      });
    }

    return items.slice(0, 2);
  }, [courseIdForSpotlight, courseTitle, hasFullCourseAccess, nextLesson, spotlightContests, translate]);

  const renderAccessPanel = (className?: string) => (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border-subtle bg-card shadow-card",
        className,
      )}
    >
      <div className="border-b border-border-subtle bg-muted/30 px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">
          {hasFullCourseAccess
            ? translate("detail.accessPanel.ready")
            : translate("detail.accessPanel.unlockToStart")}
        </h3>
      </div>
      <div className="p-4">

        {hasFullCourseAccess ? (
          <>
            <p className="mb-3 text-[13px] leading-6 text-muted-foreground">
              {translate("detail.accessPanel.enterToLearn")}
            </p>
            {isPaidUpfront && paymentAccess?.full_access_granted && !enrolled ? (
              <div className="mb-4 rounded-md border border-success/25 bg-success/10 p-3 text-[13px] text-success">
                {translate("detail.accessPanel.paymentConfirmed")}
              </div>
            ) : null}
            {isPaidUpfront && enrolled && !paymentAccess?.full_access_granted ? (
              <div className="mb-4 rounded-md border border-success/25 bg-success/10 p-3 text-[13px] text-success">
                {translate("detail.accessPanel.keptAccess")}
              </div>
            ) : null}
            <div className="mb-4 rounded-md bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
                <span>{translate("detail.accessPanel.currentProgress")}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                {nextLesson
                  ? translate("detail.accessPanel.nextLessonLabel", {
                      title: nextLesson.title,
                    })
                  : translate("detail.accessPanel.endOfPath")}
              </p>
            </div>
            <Button
              className="w-full"
              size="default"
              type="button"
              onClick={() =>
                navigate(
                  nextLesson
                    ? `/learn/${resolvedCourseId}/lesson/${nextLesson.id}`
                    : `/learn/${resolvedCourseId}`,
                )
              }
            >
              {nextLesson
                ? translate("detail.spotlight.continueLearning")
                : translate("detail.spotlight.enterLearningPage")}
              <ArrowRight className="size-4" />
            </Button>
          </>
        ) : isPaidUpfront ? (
          <>
            <div className="mb-4 rounded-md bg-muted/40 p-3">
              <div className="text-[12px] text-muted-foreground">
                {translate("detail.accessPanel.priceLabel")}
              </div>
              <div className="mt-1 text-[20px] font-semibold text-foreground">
                {formatVndPrice(pricing.display)}
              </div>
              {pricing.promoActive ? (
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                  <span className="line-through">{formatVndPrice(pricing.base)}</span>
                  {Number.isFinite(pricing.endsAt) ? (
                    <span className="block sm:inline">
                      {" "}
                      {translate("detail.accessPanel.promoEnds", {
                        date: new Date(pricing.endsAt).toLocaleString(intlLocale()),
                      })}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <p className="mb-4 text-[13px] leading-6 text-muted-foreground">
              {translate("detail.accessPanel.paidUpfrontCopy")}
              {previewLessons.length > 0
                ? translate("detail.accessPanel.previewAvailable", {
                    count: previewLessons.length,
                  })
                : translate("detail.accessPanel.previewNotAvailable")}
            </p>
            <div className="space-y-2">
              <Button
                className="w-full"
                size="default"
                onClick={() => navigate(`/checkout/course/${resolvedCourseId}`)}
              >
                {translate("detail.accessPanel.buyCourse")}
              </Button>
              <Button
                className="w-full"
                size="default"
                variant="outline"
                onClick={handleStartPreview}
                disabled={previewLessons.length === 0}
              >
                {previewLessons.length > 0
                  ? translate("detail.accessPanel.tryFreePreview")
                  : translate("detail.accessPanel.noPreviewYet")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-[13px] leading-6 text-muted-foreground">
              {translate("detail.accessPanel.freeEnrollCopy")}
              {isFreeWithPaidCertificate
                ? translate("detail.accessPanel.certificateFeeSuffix", {
                    fee: formatVndPrice(course?.certificate_fee_vnd ?? 0),
                  })
                : ""}
            </p>
            <Button
              className="w-full"
              size="default"
              disabled={enrolling}
              onClick={() => {
                if (!isAuthenticated) {
                  navigate("/login", { state: { from: location } });
                  return;
                }
                void handleEnroll();
              }}
            >
              {enrolling
                ? translate("detail.accessPanel.processing")
                : translate("detail.accessPanel.enrollAndEnter")}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-border-subtle bg-card p-8 text-center shadow-card">
          <Spinner className="size-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-[15px] text-muted-foreground">
            {translate("detail.loadingCourse")}
          </p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-[15px] font-medium text-destructive">
            {error ?? translate("detail.notFound")}
          </p>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
          <Link
            to="/courses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            <ArrowLeft className="size-4" /> Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app py-6 sm:py-8">
      {canReviewDraft ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
          <div className="flex items-center gap-2">
            <Eye className="size-5 text-amber-600 dark:text-amber-400" weight="duotone" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Chế độ xem trước — Khoá học đang nháp (chưa xuất bản)
            </span>
          </div>
          <Link
            to={`/instructor/courses/${resolvedCourseId ?? id}/edit`}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            <PencilSimple className="size-4" /> Chỉnh sửa khoá học
          </Link>
        </div>
      ) : null}

      <Link
        to="/courses"
        className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Quay lại khoá học
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
        <div className="min-w-0">
          <section className="rounded-lg border border-border-subtle bg-card shadow-card">
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-1">
                    {getCourseLevelLabel(course.level)}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-1">
                    {getCourseAccessModelLabel(course.access_model)}
                  </span>
                  {isPaidUpfront && previewLessons.length > 0 ? (
                    <span className="rounded-md bg-success/15 px-2 py-1 text-success">
                      {previewLessons.length} bài học thử
                    </span>
                  ) : null}
                  {enrollment?.certificate_issued_at ? (
                    <span className="rounded-md bg-success/15 px-2 py-1 text-success">
                      Đã cấp chứng nhận
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {course.title}
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                  Giảng viên{" "}
                  <Link
                    to={`/instructors/${course.instructor_id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {course.instructor_name}
                  </Link>
                </p>

                {course.short_description ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {course.short_description}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-2 text-sm">
                  <dl className="grid grid-cols-2 gap-2 rounded-md border border-border-subtle bg-background p-3 text-[13px]">
                    <div>
                      <dt className="text-muted-foreground">Thời lượng</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {formatDuration(displayTotalDuration)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Curriculum</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {curriculumCountLabel}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Hoàn thành</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {course.final_assignment_title
                          ? "Có bài cuối khoá cần duyệt"
                          : isFreeWithPaidCertificate
                            ? "Có phí xét chứng nhận"
                            : "100% bài học"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="overflow-hidden rounded-md border border-border-subtle bg-muted/40">
                <div className="relative aspect-video">
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="absolute inset-0 size-full object-cover"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="mt-4 lg:hidden">{renderAccessPanel()}</div>

          <section className="mt-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
                  <BookOpen className="size-5" /> Lộ trình học
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {isPreviewOnlyCurriculum
                    ? "Bạn đang xem phần preview. Mở khoá để thấy toàn bộ curriculum."
                    : "Nội dung được chia theo chương để bạn theo dõi mạch học dễ hơn."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
                  {visibleLessonGroups.length} chương
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-[12px]"
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
                  Thu gọn curriculum
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {visibleLessonGroups.map(({ section, lessons: sectionLessons }, sectionIndex) => (
                (() => {
                  const isCollapsed = collapsedSections.has(section.id);
                  return (
                <div
                  key={section.id}
                  className="overflow-hidden rounded-xl border border-border-subtle bg-card shadow-card"
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
                    className="flex w-full flex-col gap-1.5 border-b border-border-subtle bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
                        Chương {sectionIndex + 1}
                      </p>
                      <p className="text-[15px] font-medium text-foreground">
                        {section.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <span>{sectionLessons.length} bài</span>
                      <CaretDown
                        className={cn(
                          "size-4 shrink-0 transition-transform duration-200",
                          isCollapsed ? "-rotate-90" : "rotate-0",
                        )}
                        weight="duotone"
                      />
                    </div>
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-250 ease-out",
                      isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="divide-y divide-border-subtle">
                        {sectionLessons.map((lesson, lessonIndex) => (
                          <div
                            key={lesson.id}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 transition-[opacity,transform] duration-200 ease-out sm:items-center",
                              isCollapsed ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0",
                            )}
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-medium text-muted-foreground">
                              {lessonIndex + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-[14px] text-foreground sm:line-clamp-1">
                                {lesson.title}
                              </p>
                              <p className="mt-0.5 text-[12px] text-muted-foreground">
                                {formatDuration(lesson.duration_seconds)}
                              </p>
                            </div>
                            {isPaidUpfront && lesson.is_preview_free ? (
                              <span className="mt-0.5 rounded-md bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success sm:mt-0">
                                Học thử
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          </section>

          <div className="mt-8">
            <CoreliaSpotlight
              eyebrow="Bước tiếp theo cùng Corelia"
              title="Những hoạt động nên đến sau khi bạn đã hiểu khoá học này"
              description="Phần này không cố bán thêm. Nó chỉ gợi ý những nhịp tiếp theo thực sự liên quan: quay lại bài đang dở, contest đang mở hoặc các khoá học phù hợp trong hệ sinh thái."
              items={courseSpotlightItems}
              compact
            />
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {renderAccessPanel("hidden lg:block")}
        </aside>
      </div>
    </div>
  );
}
