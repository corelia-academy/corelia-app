import { sortLocale } from "@/lib/intl";
import type { Course, CourseLevel, CourseOwnerType } from "@/types/courses";
import { getCourseOwnerTypeLabel } from "@/types/courses";

export type OwnerFilter = "all" | CourseOwnerType;
export type SortMode = "featured" | "recent" | "duration_desc" | "title_asc";

export type CatalogTranslate = (
  key: string,
  options?: { price?: string; count?: number },
) => string;

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function getFeaturedScore(course: Course): number {
  let score = 0;
  score += (course.owner_type ?? "corelia") === "corelia" ? 3 : 1;
  score += course.short_description ? 1 : 0;
  score += Math.min(
    4,
    Math.round(Number(course.total_duration_seconds ?? 0) / 7200),
  );
  return score;
}

export function sortCourses(list: Course[], sort: SortMode): Course[] {
  const next = [...list];
  if (sort === "recent") {
    return next.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  if (sort === "duration_desc") {
    return next.sort(
      (a, b) =>
        Number(b.total_duration_seconds ?? 0) -
        Number(a.total_duration_seconds ?? 0),
    );
  }
  if (sort === "title_asc") {
    return next.sort((a, b) => a.title.localeCompare(b.title, sortLocale()));
  }
  return next.sort((a, b) => {
    const scoreDiff = getFeaturedScore(b) - getFeaturedScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export function filterAndSortCourses(
  courses: Course[],
  opts: {
    query: string;
    levelFilter: "all" | CourseLevel;
    ownerFilter: OwnerFilter;
    sortMode: SortMode;
  },
): Course[] {
  const normalizedQuery = normalizeText(opts.query);
  const base = courses.filter((course) => {
    if (opts.levelFilter !== "all" && course.level !== opts.levelFilter) {
      return false;
    }
    if (
      opts.ownerFilter !== "all" &&
      (course.owner_type ?? "corelia") !== opts.ownerFilter
    ) {
      return false;
    }
    if (!normalizedQuery) return true;

    const haystack = [
      course.title,
      course.short_description,
      course.description,
      course.instructor_name,
      getCourseOwnerTypeLabel(course.owner_type),
    ]
      .map(normalizeText)
      .join(" ");

    return haystack.includes(normalizedQuery);
  });

  return sortCourses(base, opts.sortMode);
}
