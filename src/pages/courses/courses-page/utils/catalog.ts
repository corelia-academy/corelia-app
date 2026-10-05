import { sortLocale } from "@/lib/intl";
import type { Course, CourseLevel, CourseOwnerType } from "@/types/courses";
import { getCourseOwnerTypeLabel } from "@/types/courses";

export type OwnerFilter = "all" | CourseOwnerType;
export type SortMode = "featured" | "recent" | "duration_desc" | "title_asc";

export type CatalogTranslate = (
  key: string,
  options?: { price?: string; count?: number },
) => string;

export interface CatalogInstructorOption {
  id: string;
  name: string;
}

export function getCatalogSkillOptions(courses: Course[]): string[] {
  return Array.from(
    new Set(courses.flatMap((course) => course.skills ?? []).map((skill) => skill.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, sortLocale()));
}

export function getCatalogInstructorOptions(courses: Course[]): CatalogInstructorOption[] {
  const instructors = new Map<string, string>();
  for (const course of courses) {
    const primaryName =
      typeof course.instructor_name === "string"
        ? course.instructor_name.trim()
        : "";
    if (course.instructor_id && primaryName && !instructors.has(course.instructor_id)) {
      instructors.set(course.instructor_id, primaryName);
    }

    for (const instructor of course.co_instructors ?? []) {
      const name = instructor.name.trim();
      if (instructor.id && name && !instructors.has(instructor.id)) {
        instructors.set(instructor.id, name);
      }
    }
  }

  return Array.from(instructors, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name, sortLocale()),
  );
}

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
    levelFilter: readonly Exclude<CourseLevel, "all">[];
    selectedSkills: readonly string[];
    selectedInstructorIds: readonly string[];
    ownerFilter: OwnerFilter;
    sortMode: SortMode;
  },
): Course[] {
  const normalizedQuery = normalizeText(opts.query);
  const selectedSkills = new Set(opts.selectedSkills.map(normalizeText));
  const selectedInstructorIds = new Set(opts.selectedInstructorIds);
  const base = courses.filter((course) => {
    if (opts.levelFilter.length > 0 && !opts.levelFilter.some((level) => level === course.level)) {
      return false;
    }
    if (
      selectedSkills.size > 0 &&
      !(course.skills ?? []).some((skill) => selectedSkills.has(normalizeText(skill)))
    ) return false;

    if (selectedInstructorIds.size > 0) {
      const courseInstructorIds = [
        course.instructor_id,
        ...(course.co_instructors ?? []).map((instructor) => instructor.id),
      ];
      if (!courseInstructorIds.some((id) => selectedInstructorIds.has(id))) return false;
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
      ...(course.co_instructors ?? []).map((instructor) => instructor.name),
      ...(course.skills ?? []),
      getCourseOwnerTypeLabel(course.owner_type),
    ]
      .map(normalizeText)
      .join(" ");

    return haystack.includes(normalizedQuery);
  });

  return sortCourses(base, opts.sortMode);
}
