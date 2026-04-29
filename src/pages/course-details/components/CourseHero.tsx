import { useState } from "react";
import { Link } from "react-router";
import { BookOpen, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CourseBadge } from "./CourseBadge";
import i18n from "@/i18n";
import {
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
}

export function CourseHero({
  course,
  enrollment,
  isPaidUpfront,
  isFreeWithPaidCertificate,
  previewLessons,
  displayTotalDuration,
  curriculumCountLabel,
}: CourseHeroProps) {
  const { t } = useTranslation(["courses", "common"]);
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));
  const translateCommon = (key: string, options?: Record<string, unknown>) =>
    String(t(`common:${key}` as never, options as never));
  const [failedThumbnailSrc, setFailedThumbnailSrc] = useState<string | null>(
    null,
  );

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
    <section className="rounded-md border border-border-subtle bg-card shadow-sm">
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <CourseBadge variant="secondary">
              {getCourseLevelLabel(course.level)}
            </CourseBadge>
            <CourseBadge variant="secondary">
              {getCourseAccessModelLabel(course.access_model)}
            </CourseBadge>
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
            {enrollment?.certificate_issued_at ? (
              <CourseBadge variant="success">
                {translate("detail.courseDetail.certificateIssued")}
              </CourseBadge>
            ) : null}
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {course.title}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {translate("detail.courseDetail.instructorLabel")}{" "}
            <Link
              to={`/instructors/${course.instructor_id}`}
              className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
            >
              {course.instructor_name}
            </Link>
          </p>

          {course.short_description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {course.short_description}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 text-sm">
            <dl className="grid grid-cols-1 gap-2 rounded-md bg-muted/30 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">
                  {translate("detail.courseDetail.stats.duration")}
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {formatDuration(displayTotalDuration)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {translate("detail.courseDetail.stats.curriculum")}
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {curriculumCountLabel}
                </dd>
              </div>
            </dl>

            {course.is_updating ? (
              <div className="rounded-md border border-border-subtle bg-muted/30 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Info
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                  {translate(
                    "detail.courseDetail.courseUpdatingNotice.title",
                  )}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {translate(
                        "detail.courseDetail.courseUpdatingNotice.body",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {shouldShowContentLocaleNotice ? (
              <div className="rounded-md border border-border-subtle bg-muted/30 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Info
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <p className="min-w-0 text-muted-foreground">
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

        <div className="overflow-hidden rounded-md border border-border-subtle bg-muted/30">
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
                <div className="flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
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
