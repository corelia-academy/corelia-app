import { queryOptions } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import {
  applyCourseLessonLocaleContent,
  applyCourseLocaleContent,
  applyCourseSectionLocaleContent,
  getCourse,
  getCourseBySlug,
  getCourseLessonLocaleContentMap,
  getCourseLessons,
  getCourseLocaleContent,
  getCourseSectionLocaleContentMap,
  getCourseSections,
  getBatchCourseLocaleContent,
  getEnrollment,
  getLessonProgressForCourse,
  getMyEnrollments,
  getPublishedCourses,
  computeProgressPercent,
  sortLessonsByCurriculum,
  pickCourseContentLocale,
} from "@/lib/courses";
import { getSubmission } from "@/lib/finalAssignment";
import { listPublicContests } from "@/lib/hackathons";
import { getPublicProfileById } from "@/lib/profile";
import type {
  Course,
  CourseLesson,
  CourseSection,
  Enrollment,
  LessonProgress,
} from "@/types/courses";
import type { PublicProfile } from "@/types/database";
import type { Contest } from "@/types/hackathons";

export interface CourseBundle {
  course: Course | null;
  sections: CourseSection[];
  lessons: CourseLesson[];
  resolvedCourseId: string | null;
  canonicalSlug: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function abortIfNeeded(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Query cancelled", "AbortError");
}

async function resolveCourse(courseRef: string, viewer: User | null) {
  if (UUID_PATTERN.test(courseRef)) return getCourse(courseRef);

  const bySlug = await getCourseBySlug(courseRef, viewer);
  return bySlug ?? getCourse(courseRef);
}

async function loadCourseBundle(
  courseRef: string,
  locale: string,
  viewer: User | null,
  previewOnly: boolean,
  signal: AbortSignal,
): Promise<CourseBundle> {
  abortIfNeeded(signal);
  const course = await resolveCourse(courseRef, viewer);
  abortIfNeeded(signal);

  if (!course) {
    return {
      course: null,
      sections: [],
      lessons: [],
      resolvedCourseId: null,
      canonicalSlug: null,
    };
  }

  const contentLocale = pickCourseContentLocale(course, locale);
  const [sections, lessons, localizedCourse, sectionMap, lessonMap] =
    await Promise.all([
      getCourseSections(course.id),
      getCourseLessons(course.id, { previewOnly }),
      getCourseLocaleContent(course.id, contentLocale).catch(() => null),
      getCourseSectionLocaleContentMap(course.id, contentLocale).catch(
        () => new Map(),
      ),
      getCourseLessonLocaleContentMap(course.id, contentLocale).catch(
        () => new Map(),
      ),
    ]);
  abortIfNeeded(signal);

  return {
    course: applyCourseLocaleContent(course, localizedCourse),
    sections: sections.map((section) =>
      applyCourseSectionLocaleContent(
        section,
        sectionMap.get(section.id) ?? null,
      ),
    ),
    lessons: lessons.map((lesson) =>
      applyCourseLessonLocaleContent(
        lesson,
        lessonMap.get(lesson.id) ?? null,
      ),
    ),
    resolvedCourseId: course.id,
    canonicalSlug: course.slug ?? null,
  };
}

export const courseKeys = {
  all: ["courses"] as const,
  bundle: (
    courseRef: string,
    locale: string,
    userId: string | null,
    previewOnly: boolean,
  ) =>
    [
      ...courseKeys.all,
      "bundle",
      courseRef,
      locale,
      userId ?? "anonymous",
      previewOnly ? "preview" : "full",
    ] as const,
  enrollment: (userId: string, courseId: string) =>
    [...courseKeys.all, "enrollment", userId, courseId] as const,
  progress: (userId: string, courseId: string) =>
    [...courseKeys.all, "progress", userId, courseId] as const,
  submission: (userId: string, courseId: string) =>
    [...courseKeys.all, "submission", userId, courseId] as const,
  instructor: (profileId: string) =>
    [...courseKeys.all, "instructor", profileId] as const,
  spotlight: (userId: string | null, locale: string) =>
    [...courseKeys.all, "spotlight", userId ?? "anonymous", locale] as const,
  catalog: (locale: string) => [...courseKeys.all, "catalog", locale] as const,
  userCatalogProgress: (userId: string) =>
    [...courseKeys.all, "catalog-progress", userId] as const,
};

export function courseBundleQueryOptions({
  courseRef,
  locale,
  viewer,
  previewOnly = false,
}: {
  courseRef: string | undefined;
  locale: string;
  viewer: User | null;
  previewOnly?: boolean;
}) {
  const normalizedRef = courseRef?.trim() ?? "";
  return queryOptions<CourseBundle>({
    queryKey: courseKeys.bundle(
      normalizedRef || "missing",
      locale,
      viewer?.id ?? null,
      previewOnly,
    ),
    queryFn: ({ signal }) =>
      loadCourseBundle(normalizedRef, locale, viewer, previewOnly, signal),
    enabled: normalizedRef.length > 0,
    staleTime: 60_000,
    meta: viewer
      ? { scope: "private", userId: viewer.id, showInGlobalLoading: true }
      : { scope: "public", showInGlobalLoading: true },
  });
}

export function courseEnrollmentQueryOptions(
  userId: string | undefined,
  courseId: string | null | undefined,
) {
  const hasContext = Boolean(userId && courseId);
  return queryOptions<Enrollment | null>({
    queryKey: courseKeys.enrollment(userId || "missing", courseId || "missing"),
    queryFn: () => getEnrollment(userId!, courseId!),
    enabled: hasContext,
    staleTime: 30_000,
    retry: false,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function courseProgressQueryOptions(
  userId: string | undefined,
  courseId: string | null | undefined,
) {
  const hasContext = Boolean(userId && courseId);
  return queryOptions<LessonProgress[]>({
    queryKey: courseKeys.progress(userId || "missing", courseId || "missing"),
    queryFn: () => getLessonProgressForCourse(userId!, courseId!),
    enabled: hasContext,
    staleTime: 15_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function courseSubmissionQueryOptions(
  userId: string | undefined,
  courseId: string | undefined,
) {
  const hasContext = Boolean(userId && courseId);
  return queryOptions({
    queryKey: courseKeys.submission(userId || "missing", courseId || "missing"),
    queryFn: () => getSubmission(userId!, courseId!),
    enabled: hasContext,
    staleTime: 30_000,
    retry: false,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function instructorProfileQueryOptions(profileId: string | undefined) {
  return queryOptions<PublicProfile | null>({
    queryKey: courseKeys.instructor(profileId || "missing"),
    queryFn: () => getPublicProfileById(profileId!),
    enabled: Boolean(profileId),
    staleTime: 5 * 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

export function spotlightContestsQueryOptions(
  user: User | null,
  locale: string,
) {
  return queryOptions<Contest[]>({
    queryKey: courseKeys.spotlight(user?.id ?? null, locale),
    queryFn: async () => {
      const contests = await listPublicContests(locale);
      return contests.filter(
        (contest) =>
          contest.status === "published" || contest.status === "running",
      );
    },
    staleTime: 60_000,
    meta: user
      ? { scope: "private", userId: user.id, showInGlobalLoading: false }
      : { scope: "public", showInGlobalLoading: false },
  });
}

export function coursesCatalogQueryOptions(locale: string) {
  return queryOptions({
    queryKey: courseKeys.catalog(locale),
    queryFn: async () => {
      const courses = await getPublishedCourses();
      if (locale === "vi" || courses.length === 0) return courses;
      const localeMap = await getBatchCourseLocaleContent(
        courses.map((course) => course.id),
        locale === "en" ? "en" : "vi",
      );
      return courses.map((course) =>
        applyCourseLocaleContent(course, localeMap.get(course.id) ?? null),
      );
    },
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: true },
  });
}

export function userCoursesProgressQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: courseKeys.userCatalogProgress(userId || "missing"),
    queryFn: async () => {
      const enrollments = await getMyEnrollments(userId!);
      const entries = await Promise.all(
        enrollments.map(async (enrollment) => {
          const [lessons, sections, progress] = await Promise.all([
            getCourseLessons(enrollment.course_id),
            getCourseSections(enrollment.course_id),
            getLessonProgressForCourse(userId!, enrollment.course_id),
          ]);
          const sorted = sortLessonsByCurriculum(lessons, sections);
          return [
            enrollment.course_id,
            { enrolled: true, percent: computeProgressPercent(sorted, progress) },
          ] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}
