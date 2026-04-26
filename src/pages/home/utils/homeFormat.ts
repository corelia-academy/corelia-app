import i18n from "@/i18n";
import type { Course } from "@/types/courses";
import { getCourseLevelLabel } from "@/types/courses";

export function formatCourseMeta(
  course: Course,
  format: "online" | "offline",
): string {
  const durationHours =
    course.total_duration_seconds && course.total_duration_seconds > 0
      ? i18n.t("common:home.meta.hours", {
          count: Math.max(1, Math.round(course.total_duration_seconds / 3600)),
        })
      : i18n.t("common:home.meta.selfPaced");
  return format === "online"
    ? `${durationHours} · ${getCourseLevelLabel(course.level)}`
    : `${i18n.t("common:home.meta.offlinePrefix")} · ${getCourseLevelLabel(course.level)}`;
}

export function pickCourseFormat(course: Course): "online" | "offline" {
  return course.owner_type === "external_partner" ? "offline" : "online";
}

