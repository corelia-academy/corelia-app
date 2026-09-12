import type { CourseInstructorRef } from "./types";

/** Invalid metadata stays untouched in authoring; public consumers can fall back. */
export function parseCourseInstructors(value: unknown): CourseInstructorRef[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.profile_id !== "string" ||
      !item.profile_id.trim() || seen.has(item.profile_id) ||
      !Number.isSafeInteger(item.order) || item.order < 0 ||
      (item.role_label !== undefined && typeof item.role_label !== "string")) return null;
    seen.add(item.profile_id);
  }
  return [...value].sort((a, b) => a.order - b.order);
}
