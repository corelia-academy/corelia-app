import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import {
  getCoursePrimaryLocale,
  getCourseSupportedLocales,
  normalizeCourseLocale,
} from "@/lib/courses";
import type { Course, CourseLesson } from "@/types/courses";
import { CourseBadge } from "./CourseBadge";

export function CourseLanguagePanel({
  course,
  lessons: _lessons,
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
  const primaryContentLocale = getCoursePrimaryLocale(course);
  const defaultVideoLocale = normalizeCourseLocale(
    course.i18n?.default_video_primary_locale ?? primaryContentLocale,
  );

  const localeLabel = (loc: "vi" | "en") =>
    loc === "en"
      ? translateCommon("language.en")
      : translateCommon("language.vi");

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-foreground">
          {translate("detail.courseDetail.languagePanel.title")}
        </h3>

        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-foreground-muted">
              {translate("detail.courseDetail.stats.videoLanguage")}
            </dt>
            <dd className="font-medium text-foreground">
              {localeLabel(defaultVideoLocale)}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
          <span className="mr-1">
            {translate("detail.courseDetail.language.supportedLabel")}
          </span>
          {supportedLocales.map((loc) => (
            <CourseBadge key={loc} variant="outline">
              {localeLabel(loc)}
            </CourseBadge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
