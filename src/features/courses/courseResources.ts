import { validateLessonResources } from "@/features/learning/resourceValidation";
import type { CourseResource, CourseResourceIcon } from "@/types/courses";

export const COURSE_RESOURCE_ICONS = [
  "link", "github", "discord", "telegram", "youtube", "document", "code", "community", "website",
] as const satisfies readonly CourseResourceIcon[];

export function isCourseResourceIcon(value: unknown): value is CourseResourceIcon {
  return COURSE_RESOURCE_ICONS.includes(value as CourseResourceIcon);
}

export function isValidCourseResources(value: unknown): value is CourseResource[] {
  return validateLessonResources(value, "course", "vi", true).length === 0
    && (value as CourseResource[]).every(item => item.icon === undefined || isCourseResourceIcon(item.icon));
}

/** Legacy malformed entries must never become clickable links. */
export function visibleCourseResources(value: unknown): CourseResource[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => isValidCourseResources([item]));
}

/** Keep editable strings, including invalid URLs, so authors can repair them. */
export function courseResourceDraft(value: unknown): CourseResource[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    title: typeof item?.title === "string" ? item.title : "",
    url: typeof item?.url === "string" ? item.url : "",
    icon: isCourseResourceIcon(item?.icon) ? item.icon : "link",
  }));
}
