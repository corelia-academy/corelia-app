import { useState } from "react";
import { Link } from "react-router";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("courses");
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));
  const [failedThumbnailSrc, setFailedThumbnailSrc] = useState<string | null>(
    null,
  );

  const courseThumbnailSrc =
    course.thumbnail_url &&
    course.thumbnail_url.trim().length > 0 &&
    course.thumbnail_url !== failedThumbnailSrc
      ? course.thumbnail_url
      : null;

  return (
    <section className="rounded-md border border-border-subtle bg-card shadow-card">
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-1">
              {getCourseLevelLabel(course.level)}
            </span>
            <span className="rounded-md bg-muted px-2 py-1">
              {getCourseAccessModelLabel(course.access_model)}
            </span>
            {isPaidUpfront && previewLessons.length > 0 ? (
              <span className="rounded-md bg-success/15 px-2 py-1 text-success">
                {translate("detail.courseDetail.lessonCountPreview", {
                  count: previewLessons.length,
                })}
              </span>
            ) : null}
            {enrollment?.certificate_issued_at ? (
              <span className="rounded-md bg-success/15 px-2 py-1 text-success">
                {translate("detail.courseDetail.certificateIssued")}
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {course.title}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {translate("detail.courseDetail.instructorLabel")}{" "}
            <Link
              to={`/instructors/${course.instructor_id}`}
              className="font-medium text-foreground hover:underline"
            >
              {course.instructor_name}
            </Link>
          </p>

          {course.short_description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {course.short_description}
            </p>
          ) : null}

          <div className="mt-4 grid gap-2 text-sm">
            <dl className="grid grid-cols-2 gap-2 rounded-md border border-border-subtle bg-background p-3 text-sm">
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
              <div className="col-span-2">
                <dt className="text-muted-foreground">
                  {translate("detail.courseDetail.stats.completion")}
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {course.final_assignment_title
                    ? translate(
                        "detail.courseDetail.completion.hasFinalAssignment",
                      )
                    : isFreeWithPaidCertificate
                      ? translate(
                          "detail.courseDetail.completion.certificateFeeRequired",
                        )
                      : translate(
                          "detail.courseDetail.completion.fullLessons",
                        )}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-md border border-border-subtle bg-muted/40 lg:aspect-auto lg:h-full">
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
    </section>
  );
}
