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
  nextLesson: CourseLesson | null;
  refresh: () => Promise<CourseProgressRefreshResult | null>;
}

export function useCourseProgress({
  resolvedCourseId,
  profileId,
  lessons,
  sections,
}: UseCourseProgressInput): UseCourseProgressResult {
  const [progressPercent, setProgressPercent] = useState(0);
  const [nextLesson, setNextLesson] = useState<CourseLesson | null>(null);
  const hasContext = !!resolvedCourseId && !!profileId;

  useEffect(() => {
    if (!resolvedCourseId || !profileId) return;
    let cancelled = false;

    getLessonProgressForCourse(profileId, resolvedCourseId)
      .then((list) => {
        if (cancelled) return;
        const sorted = sortLessonsByCurriculum(lessons, sections);
        setProgressPercent(computeProgressPercent(sorted, list));
        setNextLesson(getNextLesson(sorted, list));
      })
      .catch(() => {
        if (cancelled) return;
        setProgressPercent(0);
        setNextLesson(null);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedCourseId, profileId, lessons, sections]);

  const refresh = useCallback(async () => {
    if (!resolvedCourseId || !profileId) return null;
    const list = await getLessonProgressForCourse(profileId, resolvedCourseId);
    const sorted = sortLessonsByCurriculum(lessons, sections);
    const next = getNextLesson(sorted, list);
    setProgressPercent(computeProgressPercent(sorted, list));
    setNextLesson(next);
    return { sorted, next };
  }, [resolvedCourseId, profileId, lessons, sections]);

  return {
    progressPercent: hasContext ? progressPercent : 0,
    nextLesson: hasContext ? nextLesson : null,
    refresh,
  };
}
