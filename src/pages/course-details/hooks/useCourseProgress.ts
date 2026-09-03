import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { courseProgressQueryOptions } from "@/features/courses/courseQueries";
import {
  computeProgressPercent,
  getNextLesson,
  sortLessonsByCurriculum,
} from "@/lib/courses";
import type { CourseLesson, CourseSection } from "@/types/courses";

interface UseCourseProgressInput {
  resolvedCourseId: string | null;
  profileId: string | undefined;
  lessons: CourseLesson[];
  sections: CourseSection[];
}

export interface CourseProgressRefreshResult {
  sorted: CourseLesson[];
  next: CourseLesson | null;
}

interface UseCourseProgressResult {
  progressPercent: number;
  hasStarted: boolean;
  nextLesson: CourseLesson | null;
  refresh: () => Promise<CourseProgressRefreshResult | null>;
}

export function useCourseProgress({
  resolvedCourseId,
  profileId,
  lessons,
  sections,
}: UseCourseProgressInput): UseCourseProgressResult {
  const progressQuery = useQuery(
    courseProgressQueryOptions(profileId, resolvedCourseId),
  );
  const list = progressQuery.data ?? [];
  const sorted = useMemo(
    () => sortLessonsByCurriculum(lessons, sections),
    [lessons, sections],
  );

  const refresh = useCallback(async () => {
    if (!resolvedCourseId || !profileId) return null;
    const result = await progressQuery.refetch();
    const refreshed = result.data ?? [];
    return { sorted, next: getNextLesson(sorted, refreshed) };
  }, [profileId, progressQuery, resolvedCourseId, sorted]);

  return {
    progressPercent: computeProgressPercent(sorted, list),
    hasStarted: list.length > 0,
    nextLesson: getNextLesson(sorted, list),
    refresh,
  };
}
