import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeProgressPercent,
  getCompletedLessonIds,
  getLessonProgressForCourse,
  getNextLesson,
} from "@/lib/courses";
import type { CourseLesson, LessonProgress } from "@/types/courses";

const EMPTY_PROGRESS_LIST: LessonProgress[] = [];

interface UseLearnProgressInput {
  courseId: string | undefined;
  profileId: string | undefined;
  visibleLessons: CourseLesson[];
}

interface UseLearnProgressResult {
  progressList: LessonProgress[];
  completedIds: Set<string>;
  progressPercent: number;
  nextLesson: CourseLesson | null;
  refresh: () => Promise<LessonProgress[] | null>;
  setProgressList: React.Dispatch<React.SetStateAction<LessonProgress[]>>;
}

export function useLearnProgress({
  courseId,
  profileId,
  visibleLessons,
}: UseLearnProgressInput): UseLearnProgressResult {
  const [progressList, setProgressList] = useState<LessonProgress[]>([]);
  const hasContext = !!courseId && !!profileId;

  useEffect(() => {
    if (!courseId || !profileId) return;
    let cancelled = false;
    getLessonProgressForCourse(profileId, courseId)
      .then((rows) => {
        if (!cancelled) setProgressList(rows);
      })
      .catch(() => {
        if (!cancelled) setProgressList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, profileId]);

  const effectiveProgressList = useMemo(
    () => (hasContext ? progressList : EMPTY_PROGRESS_LIST),
    [hasContext, progressList],
  );

  const completedIds = useMemo(
    () => getCompletedLessonIds(visibleLessons, effectiveProgressList),
    [effectiveProgressList, visibleLessons],
  );
  const progressPercent = useMemo(
    () => computeProgressPercent(visibleLessons, effectiveProgressList),
    [effectiveProgressList, visibleLessons],
  );
  const nextLesson = useMemo(
    () => getNextLesson(visibleLessons, effectiveProgressList),
    [effectiveProgressList, visibleLessons],
  );

  const refresh = useCallback(async () => {
    if (!courseId || !profileId) return null;
    const rows = await getLessonProgressForCourse(profileId, courseId);
    setProgressList(rows);
    return rows;
  }, [courseId, profileId]);

  return {
    progressList: effectiveProgressList,
    completedIds,
    progressPercent,
    nextLesson,
    refresh,
    setProgressList,
  };
}

