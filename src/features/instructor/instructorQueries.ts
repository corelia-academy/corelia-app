import { queryOptions } from "@tanstack/react-query";

import {
  getCourse,
  getCoursesForManagement,
  getPublishedCoursesByInstructor,
} from "@/lib/courses";
import { getPublicProfileById } from "@/lib/profile";

export const instructorKeys = {
  all: ["instructor"] as const,
  managedCourses: (userId: string, canViewAll: boolean) =>
    [...instructorKeys.all, "managed-courses", userId, canViewAll] as const,
  publicDetail: (profileId: string) =>
    [...instructorKeys.all, "public-detail", profileId] as const,
  courseTitle: (courseId: string) =>
    [...instructorKeys.all, "course-title", courseId] as const,
};

export function managedCoursesQueryOptions(
  userId: string | undefined,
  canViewAll: boolean,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: instructorKeys.managedCourses(userId || "missing", canViewAll),
    queryFn: () => getCoursesForManagement(userId!, canViewAll),
    enabled: Boolean(userId && enabled),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function publicInstructorDetailQueryOptions(
  profileId: string | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: instructorKeys.publicDetail(profileId || "missing"),
    queryFn: async () => {
      const [profile, courses] = await Promise.all([
        getPublicProfileById(profileId!),
        getPublishedCoursesByInstructor(profileId!),
      ]);
      return { profile, courses };
    },
    enabled: Boolean(profileId && enabled),
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

export function instructorCourseTitleQueryOptions(
  courseId: string | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: instructorKeys.courseTitle(courseId || "missing"),
    queryFn: async () => (await getCourse(courseId!))?.title ?? null,
    enabled: Boolean(courseId && enabled),
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}
