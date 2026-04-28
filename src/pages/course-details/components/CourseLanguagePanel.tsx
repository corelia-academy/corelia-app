import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import {
  getCoursePrimaryLocale,
  getCourseSupportedLocales,
  normalizeCourseLocale,
  pickCourseContentLocale,
} from "@/lib/courses";
import type { Course, CourseLesson } from "@/types/courses";
import { CourseBadge } from "./CourseBadge";

export function CourseLanguagePanel({
  course,
  lessons,
}: {
  course: Course;
  lessons: CourseLesson[];
}) {
  const { t } = useTranslation(["courses", "common"]);
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));
  const translateCommon = (key: string, options?: Record<string, unknown>) =>
    String(t(`common:${key}` as never, options as never));

  const supportedLocales = getCourseSupportedLocales(course);
  const contentLocale = pickCourseContentLocale(course, i18n.language);
  const primaryContentLocale = getCoursePrimaryLocale(course);
  const defaultVideoLocale = normalizeCourseLocale(
    course.i18n?.default_video_primary_locale ?? primaryContentLocale,
  );

  const localeLabel = (loc: "vi" | "en") =>
    loc === "en"
      ? translateCommon("language.en")
      : translateCommon("language.vi");

  const subtitlesCoverage = useMemo(() => {
    const list = Array.isArray(lessons) ? lessons : [];
    const withSubtitles = list.filter((l) => {
      const locales = Array.isArray(l.subtitle_locales) ? l.subtitle_locales : [];
      return l.has_subtitle === true || locales.length > 0;
    }).length;
    const locales = new Set<"vi" | "en">();
    for (const l of list) {
      const arr = Array.isArray(l.subtitle_locales) ? l.subtitle_locales : [];
      for (const loc of arr) locales.add(normalizeCourseLocale(loc));
    }
    return { withSubtitles, total: list.length, locales: Array.from(locales) };
  }, [lessons]);

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-foreground">
          {translate("detail.courseDetail.languagePanel.title")}
        </h3>

        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">
              {translate("detail.courseDetail.stats.contentLanguage")}
            </dt>
            <dd className="font-medium text-foreground">
              {localeLabel(contentLocale)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">
              {translate("detail.courseDetail.stats.videoLanguage")}
            </dt>
            <dd className="font-medium text-foreground">
              {localeLabel(defaultVideoLocale)}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="mr-1">
            {translate("detail.courseDetail.language.supportedLabel")}
          </span>
          {supportedLocales.map((loc) => (
            <CourseBadge key={loc} variant="outline">
              {localeLabel(loc)}
            </CourseBadge>
          ))}
        </div>

        {subtitlesCoverage.total > 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span>
              {translate("detail.courseDetail.subtitles.coverage", {
                with: subtitlesCoverage.withSubtitles,
                total: subtitlesCoverage.total,
              })}
            </span>
            {subtitlesCoverage.locales.length > 0 ? (
              <span className="truncate">
                {subtitlesCoverage.locales.map(localeLabel).join(" · ")}
              </span>
            ) : null}
          </div>
        ) : null}

        {course.i18n?.subtitle_note_policy !== "none" ? (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {translate("detail.courseDetail.subtitles.note")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

