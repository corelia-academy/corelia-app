import { useCallback, useEffect, useState } from "react";
import {
  computeProgressPercent,
  getLessonProgressForCourse,
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

interface CourseProgressData {
  progressPercent: number;
  hasStarted: boolean;
  nextLesson: CourseLesson | null;
}

const INITIAL_PROGRESS_DATA: CourseProgressData = {
  progressPercent: 0,
  hasStarted: false,
  nextLesson: null,
};

export function useCourseProgress({
  resolvedCourseId,
  profileId,
  lessons,
  sections,
}: UseCourseProgressInput): UseCourseProgressResult {
  const requestKey =
    resolvedCourseId && profileId ? `${profileId}:${resolvedCourseId}` : "";
  const [loadedResult, setLoadedResult] = useState<{
    requestKey: string;
    data: CourseProgressData;
  }>({
    requestKey: "",
    data: INITIAL_PROGRESS_DATA,
  });

  useEffect(() => {
    if (!resolvedCourseId || !profileId || !requestKey) return;
    let cancelled = false;

    getLessonProgressForCourse(profileId, resolvedCourseId)
      .then((list) => {
        if (cancelled) return;
        const sorted = sortLessonsByCurriculum(lessons, sections);
        setLoadedResult({
          requestKey,
          data: {
            hasStarted: list.length > 0,
            progressPercent: computeProgressPercent(sorted, list),
            nextLesson: getNextLesson(sorted, list),
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedResult({
          requestKey,
          data: INITIAL_PROGRESS_DATA,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedCourseId, profileId, lessons, sections, requestKey]);

  const refresh = useCallback(async () => {
    if (!resolvedCourseId || !profileId || !requestKey) return null;
    const list = await getLessonProgressForCourse(profileId, resolvedCourseId);
    const sorted = sortLessonsByCurriculum(lessons, sections);
    const next = getNextLesson(sorted, list);
    const nextData: CourseProgressData = {
      hasStarted: list.length > 0,
      progressPercent: computeProgressPercent(sorted, list),
      nextLesson: next,
    };
    setLoadedResult({ requestKey, data: nextData });
    return { sorted, next };
  }, [resolvedCourseId, profileId, lessons, sections, requestKey]);

  const isCurrent = Boolean(requestKey) && loadedResult.requestKey === requestKey;
  const currentData = isCurrent ? loadedResult.data : INITIAL_PROGRESS_DATA;

  return {
    progressPercent: currentData.progressPercent,
    hasStarted: currentData.hasStarted,
    nextLesson: currentData.nextLesson,
    refresh,
  };
}
