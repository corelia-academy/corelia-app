import { validateLessonResources } from "@/features/learning/resourceValidation";
import type { CourseResource } from "@/types/courses";

export function isValidCourseResources(value: unknown): value is CourseResource[] {
  return validateLessonResources(value, "course", "vi", true).length === 0;
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
  }));
}
