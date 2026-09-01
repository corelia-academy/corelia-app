import { queryOptions } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import type { TFunction } from "i18next";

import { intlLocale } from "@/lib/intl";
import type { Contest } from "@/types/hackathons";
import type { Course } from "@/types/courses";
import { formatCourseMeta, pickCourseFormat } from "../utils/homeFormat";
import type { FocusCard } from "../utils/homeTypes";

type HomeCatalogPayload = {
  courseCatalog: Course[];
  contests: Contest[];
};

type HomeDashboardPayload = {
  focusCards: FocusCard[];
  issuedCertificates: number;
};

const EMPTY_DASHBOARD: HomeDashboardPayload = { focusCards: [], issuedCertificates: 0 };

export const homeKeys = {
  all: ["home"] as const,
  catalog: (userId: string | null, locale: string) =>
    [...homeKeys.all, "catalog", userId ?? "anonymous", locale] as const,
  dashboard: (userId: string | null, locale: string) =>
    [...homeKeys.all, "dashboard", userId ?? "anonymous", locale] as const,
};

export function homeCatalogQueryOptions(user: User | null, locale: string) {
  return queryOptions<HomeCatalogPayload>({
    queryKey: homeKeys.catalog(user?.id ?? null, locale),
    queryFn: async () => {
      const [coursesModule, hackathonsModule] = await Promise.all([
        import("@/lib/courses"),
        import("@/lib/hackathons"),
      ]);
      const [publishedCourses, contestList] = await Promise.all([
        coursesModule.getPublishedCourses(),
        hackathonsModule.listContests(user),
      ]);
      const previewCourses = publishedCourses.slice(0, 8);
      const contentLocale = coursesModule.pickCourseContentLocale(previewCourses[0], locale);
      const localeMap = previewCourses.length
        ? await coursesModule
            .getBatchCourseLocaleContent(
              previewCourses.map((course) => course.id),
              contentLocale,
            )
            .catch(() => new Map())
        : new Map();
      const localizedMap = new Map(
        previewCourses.map((course) => [
          course.id,
          coursesModule.applyCourseLocaleContent(course, localeMap.get(course.id) ?? null),
        ]),
      );

      return {
        courseCatalog: publishedCourses.map((course) => localizedMap.get(course.id) ?? course),
        contests: contestList.filter(
          (contest) => contest.status === "published" || contest.status === "running",
        ),
      };
    },
    staleTime: 60_000,
    meta: user
      ? { scope: "private", userId: user.id, showInGlobalLoading: false }
      : { scope: "public", showInGlobalLoading: false },
  });
}

export function homeDashboardQueryOptions(
  user: User | null,
  locale: string,
  t: TFunction<"common">,
) {
  return queryOptions<HomeDashboardPayload>({
    queryKey: homeKeys.dashboard(user?.id ?? null, locale),
    queryFn: async () => {
      if (!user) return EMPTY_DASHBOARD;
      const {
        computeProgressPercent,
        getCourse,
        getCourseLessons,
        getCourseSections,
        getLessonProgressForCourse,
        getMyEnrollments,
        getNextLesson,
        sortLessonsByCurriculum,
      } = await import("@/lib/courses");

      const enrollments = await getMyEnrollments(user.id);
      const enrollmentCards = await Promise.all(
        enrollments.slice(0, 2).map(async (enrollment): Promise<FocusCard | null> => {
          const [course, lessons, sections, progress] = await Promise.all([
            getCourse(enrollment.course_id),
            getCourseLessons(enrollment.course_id),
            getCourseSections(enrollment.course_id),
            getLessonProgressForCourse(user.id, enrollment.course_id),
          ]);
          if (!course) return null;
          const sortedLessons = sortLessonsByCurriculum(lessons, sections);
          const percent = computeProgressPercent(sortedLessons, progress);
          const nextLesson = getNextLesson(sortedLessons, progress);
          const format = pickCourseFormat(course);
          return {
            id: course.id,
            title: course.title,
            format,
            progress: percent,
            nextStep:
              format === "online"
                ? nextLesson?.title
                  ? t("home.focus.nextLesson", { title: nextLesson.title })
                  : t("home.focus.allLessonsCompleted")
                : t("home.focus.lastAccessed", {
                    date: new Date(enrollment.last_accessed_at).toLocaleDateString(intlLocale()),
                  }),
            meta: formatCourseMeta(course, format),
            action: `/learn/${course.id}`,
            thumbnailUrl: course.thumbnail_url,
            lastAccessedAt: enrollment.last_accessed_at,
          };
        }),
      );

      return {
        focusCards: enrollmentCards.filter((item): item is FocusCard => item != null),
        issuedCertificates: enrollments.filter((item) => !!item.certificate_issued_at).length,
      };
    },
    enabled: user != null,
    staleTime: 30_000,
    meta: user
      ? { scope: "private", userId: user.id, showInGlobalLoading: false }
      : { scope: "public", showInGlobalLoading: false },
  });
}
