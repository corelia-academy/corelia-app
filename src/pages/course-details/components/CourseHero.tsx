import { useState } from "react";
import { BookOpen, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CourseBadge } from "./CourseBadge";
import i18n from "@/i18n";
import { type LessonTypeCounts } from "@/lib/lessonFormat";
import {
  checkAndIssueCertificate,
  courseHasCertificate,
  getCoursePrimaryLocale,
  normalizeCourseLocale,
  pickCourseContentLocale,
} from "@/lib/courses";
import {
  formatDuration,
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  type Course,
  type CourseLesson,
  type Enrollment,
} from "@/types/courses";

interface CourseHeroProps {
  course: Course;
  enrollment: Enrollment | null;
  isPaidUpfront: boolean;
  isFreeWithPaidCertificate: boolean;
  previewLessons: CourseLesson[];
  displayTotalDuration: number;
  curriculumCountLabel: string;
  detailedLessonCounts?: LessonTypeCounts;
  progressPercent?: number;
  onCertificateClaimed?: (issuedAt: string) => void;
}

export function CourseHero({
  course,
  enrollment,
  isPaidUpfront,
  isFreeWithPaidCertificate,
  previewLessons,
  displayTotalDuration,
  curriculumCountLabel,
  detailedLessonCounts,
  progressPercent = 0,
  onCertificateClaimed,
}: CourseHeroProps) {
  const { t } = useTranslation(["courses", "common"]);
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));
  const translateCommon = (key: string, options?: Record<string, unknown>) =>
    String(t(`common:${key}` as never, options as never));
  const [failedThumbnailSrc, setFailedThumbnailSrc] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const hasCourseCertificate = courseHasCertificate(course);
  const isCertificateIssued = !!enrollment?.certificate_issued_at;
  const canClaimCertificate =
    !isCertificateIssued && hasCourseCertificate && !!enrollment && progressPercent >= 100;
  const showCertificateAvailableBadge =
    hasCourseCertificate && !isCertificateIssued && !canClaimCertificate;

  const handleClaimCertificate = async () => {
    if (!enrollment || claiming) return;
    setClaiming(true);
    try {
      const result = await checkAndIssueCertificate(enrollment.user_id, course.id);
      if (result.issued) {
        onCertificateClaimed?.(result.certificate_issued_at || new Date().toISOString());
      } else if (result.message) {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : translate("detail.courseDetail.claimCertificateFailed"));
    } finally {
      setClaiming(false);
    }
  };

  const contentLocale = pickCourseContentLocale(course, i18n.language);
  // Keep this in sync with sidebar language panel; hero only needs fallback notice.
  const primaryContentLocale = getCoursePrimaryLocale(course);
  void normalizeCourseLocale(
    course.i18n?.default_video_primary_locale ?? primaryContentLocale,
  );
  const uiLocale = normalizeCourseLocale(i18n.language);
  const shouldShowContentLocaleNotice = uiLocale !== contentLocale;

  const localeLabel = (loc: "vi" | "en") =>
    loc === "en"
      ? translateCommon("language.en")
      : translateCommon("language.vi");

  const courseThumbnailSrc =
    course.thumbnail_url &&
    course.thumbnail_url.trim().length > 0 &&
    course.thumbnail_url !== failedThumbnailSrc
      ? course.thumbnail_url
      : null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card">
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
            <CourseBadge variant="secondary">
              {getCourseLevelLabel(course.level)}
            </CourseBadge>
            <CourseBadge variant="secondary">
              {getCourseAccessModelLabel(course.access_model)}
            </CourseBadge>
            {showCertificateAvailableBadge ? (
              <CourseBadge variant="secondary">
                {translate("detail.courseDetail.certificateAvailable")}
              </CourseBadge>
            ) : null}
            {isPaidUpfront && previewLessons.length > 0 ? (
              <CourseBadge variant="success">
                {translate("detail.courseDetail.lessonCountPreview", {
                  count: previewLessons.length,
                })}
              </CourseBadge>
            ) : null}
            {isFreeWithPaidCertificate ? (
              <CourseBadge variant="secondary">
                {translate("filters.pricing.certificate")}
              </CourseBadge>
            ) : null}
            {course.is_external_aggregated ? (
              <CourseBadge variant="outline">External Source</CourseBadge>
            ) : null}
            {isCertificateIssued ? (
              <CourseBadge variant="success">
                {translate("detail.courseDetail.certificateIssued")}
              </CourseBadge>
            ) : canClaimCertificate ? (
              <button
                type="button"
                onClick={() => void handleClaimCertificate()}
                disabled={claiming}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                {claiming ? "…" : translate("detail.courseDetail.claimCertificate")}
              </button>
            ) : null}
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {course.title}
          </h1>

          {course.short_description ? (
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              {course.short_description}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 text-sm">
            <dl className="grid grid-cols-1 gap-2 rounded-md bg-surface-raised p-4 text-sm sm:grid-cols-2">
              {displayTotalDuration > 0 ? (
                <div>
                  <dt className="text-foreground-muted">
                    {translate("detail.courseDetail.stats.duration")}
                  </dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatDuration(displayTotalDuration)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-foreground-muted">
                  {translate("detail.courseDetail.stats.curriculum")}
                </dt>
                <dd className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-normal">
                  {detailedLessonCounts ? (
                    <>
                      {detailedLessonCounts.videoCount > 0 ? (
                        <span className="inline-flex items-center rounded-md border border-border-subtle bg-surface-base px-2 py-0.5 text-foreground-muted">
                          {translate("detail.courseDetail.breakdown.video", {
                            count: detailedLessonCounts.videoCount,
                          })}
                        </span>
                      ) : null}
                      {detailedLessonCounts.articleCount > 0 ? (
                        <span className="inline-flex items-center rounded-md border border-border-subtle bg-surface-base px-2 py-0.5 text-foreground-muted">
                          {translate("detail.courseDetail.breakdown.article", {
                            count: detailedLessonCounts.articleCount,
                          })}
                        </span>
                      ) : null}
                      {detailedLessonCounts.quizCount > 0 ? (
                        <span className="inline-flex items-center rounded-md border border-border-subtle bg-surface-base px-2 py-0.5 text-foreground-muted">
                          {translate("detail.courseDetail.breakdown.quiz", {
                            count: detailedLessonCounts.quizCount,
                          })}
                        </span>
                      ) : null}
                      {detailedLessonCounts.practiceCount > 0 ? (
                        <span className="inline-flex items-center rounded-md border border-border-subtle bg-surface-base px-2 py-0.5 text-foreground-muted">
                          {translate("detail.courseDetail.breakdown.practice", {
                            count: detailedLessonCounts.practiceCount,
                          })}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-foreground-muted">{curriculumCountLabel}</span>
                  )}
                </dd>
              </div>
            </dl>

            {course.is_updating ? (
              <div className="rounded-md border border-border-subtle bg-surface-raised p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Info
                    className="mt-0.5 size-4 shrink-0 text-foreground-muted"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                  {translate(
                    "detail.courseDetail.courseUpdatingNotice.title",
                  )}
                    </p>
                    <p className="mt-1 text-foreground-muted">
                      {translate(
                        "detail.courseDetail.courseUpdatingNotice.body",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {shouldShowContentLocaleNotice ? (
              <div className="rounded-md border border-border-subtle bg-surface-raised p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Info
                    className="mt-0.5 size-4 shrink-0 text-foreground-muted"
                    aria-hidden
                  />
                  <p className="min-w-0 text-foreground-muted">
                    {translate(
                      "courses:detail.courseDetail.language.contentFallbackNotice",
                      {
                        content: localeLabel(contentLocale),
                      },
                    )}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
          <div className="relative aspect-video">
            <img
              src="/Corelia_Banner_Square.png"
              alt=""
              aria-hidden
              decoding="async"
              className="absolute inset-0 size-full object-cover opacity-90"
            />

            {courseThumbnailSrc ? (
              <img
                src={courseThumbnailSrc}
                alt={course.title}
                loading="lazy"
                decoding="async"
                onError={() => setFailedThumbnailSrc(course.thumbnail_url)}
                className="absolute inset-0 size-full object-cover"
              />
            ) : null}

            {!courseThumbnailSrc ? (
              <div className="absolute inset-0 grid place-items-center bg-linear-to-br from-transparent via-transparent to-background/10">
                <div className="flex items-center gap-2 rounded-full bg-surface-base/70 px-3 py-1 text-xs font-medium text-foreground-muted backdrop-blur">
                  <BookOpen className="size-4" aria-hidden />
                  {translate("detail.courseDetail.thumbnailFallback", {
                    defaultValue: "Chưa có hình ảnh khoá học",
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
