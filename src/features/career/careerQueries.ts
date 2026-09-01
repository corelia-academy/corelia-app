import { queryOptions } from "@tanstack/react-query";

import {
  getCareerTrackBySlug,
  getCareerTrackLocaleContent,
  listCareerTracks,
  listCareerTracksForInstructor,
} from "@/lib/careerTracks";
import {
  getCoursesForManagement,
  getLearnerCourseProgressSnapshot,
  getMyEnrollments,
} from "@/lib/courses";

export type CareerCourseProgress = {
  enrolled: boolean;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
};

export const careerKeys = {
  all: ["career"] as const,
  catalog: (locale: string) => [...careerKeys.all, "catalog", locale] as const,
  detail: (slug: string, locale: string) => [...careerKeys.all, "detail", slug, locale] as const,
  progress: (userId: string, courseIds: readonly string[]) =>
    [...careerKeys.all, "progress", userId, ...courseIds] as const,
  instructorList: (userId: string) =>
    [...careerKeys.all, "instructor-list", userId] as const,
  instructorEditor: (userId: string, trackId: string, locale: string) =>
    [...careerKeys.all, "instructor-editor", userId, trackId, locale] as const,
  instructorTranslation: (userId: string, trackId: string, locale: string) =>
    [...careerKeys.all, "instructor-translation", userId, trackId, locale] as const,
};

export function careerCatalogQueryOptions(locale: string) {
  return queryOptions({
    queryKey: careerKeys.catalog(locale),
    queryFn: () => listCareerTracks(locale),
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: true },
  });
}

export function instructorCareerTracksQueryOptions(
  userId: string | undefined,
) {
  return queryOptions({
    queryKey: careerKeys.instructorList(userId || "missing"),
    queryFn: listCareerTracksForInstructor,
    enabled: Boolean(userId),
    staleTime: 60_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function instructorCareerTrackEditorQueryOptions(input: {
  userId: string | undefined;
  trackId: string | undefined;
  locale: string;
}) {
  const userId = input.userId ?? "";
  const trackId = input.trackId ?? "new";
  return queryOptions({
    queryKey: careerKeys.instructorEditor(userId || "missing", trackId, input.locale),
    queryFn: async () => {
      const [courses, tracks] = await Promise.all([
        getCoursesForManagement(userId, false),
        input.trackId ? listCareerTracksForInstructor() : Promise.resolve([]),
      ]);
      return {
        courses,
        track: input.trackId
          ? tracks.find((item) => item.id === input.trackId) ?? null
          : null,
      };
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function instructorCareerTrackTranslationQueryOptions(input: {
  userId: string | undefined;
  trackId: string | undefined;
  locale: "vi" | "en";
  enabled: boolean;
}) {
  const userId = input.userId ?? "";
  const trackId = input.trackId ?? "";
  return queryOptions({
    queryKey: careerKeys.instructorTranslation(
      userId || "missing",
      trackId || "missing",
      input.locale,
    ),
    queryFn: () => getCareerTrackLocaleContent(trackId, input.locale),
    enabled: Boolean(input.enabled && userId && trackId),
    staleTime: 60_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function careerDetailQueryOptions(slug: string | undefined, locale: string) {
  const normalized = slug?.trim() ?? "";
  return queryOptions({
    queryKey: careerKeys.detail(normalized || "missing", locale),
    queryFn: () => getCareerTrackBySlug(normalized, locale),
    enabled: normalized.length > 0,
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: true },
  });
}

export function careerProgressQueryOptions(
  courseIds: string[],
  userId: string | undefined,
) {
  const normalizedIds = Array.from(new Set(courseIds.filter(Boolean))).sort();
  return queryOptions({
    queryKey: careerKeys.progress(userId || "missing", normalizedIds),
    queryFn: async () => {
      const [enrollments, snapshot] = await Promise.all([
        getMyEnrollments(userId!),
        getLearnerCourseProgressSnapshot(userId!),
      ]);
      const enrolledIds = new Set(enrollments.map((item) => item.course_id));
      const targetIds = normalizedIds.filter((id) => enrolledIds.has(id));
      const entries = targetIds.map((courseId) => {
        const progress = snapshot.progressByCourse.get(courseId) ?? [];
        const completedLessons = progress.filter((item) => item.completed_at).length;
        const totalLessons = snapshot.lessonsByCourse.get(courseId)?.length ?? 0;
        return [courseId, {
          enrolled: true,
          completedLessons,
          totalLessons,
          progressPercent: totalLessons > 0
            ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
            : 0,
        } satisfies CareerCourseProgress] as const;
      });
      return new Map(entries);
    },
    enabled: Boolean(userId && normalizedIds.length),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}
