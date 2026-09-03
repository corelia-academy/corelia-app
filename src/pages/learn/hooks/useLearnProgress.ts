import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  courseKeys,
  courseProgressQueryOptions,
} from "@/features/courses/courseQueries";
import {
  computeProgressPercent,
  getCompletedLessonIds,
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
  setProgressList: Dispatch<SetStateAction<LessonProgress[]>>;
}

export function useLearnProgress({
  courseId,
  profileId,
  visibleLessons,
}: UseLearnProgressInput): UseLearnProgressResult {
  const queryClient = useQueryClient();
  const progressQuery = useQuery(
    courseProgressQueryOptions(profileId, courseId),
  );
  const hasContext = Boolean(courseId && profileId);
  const progressList = hasContext
    ? progressQuery.data ?? EMPTY_PROGRESS_LIST
    : EMPTY_PROGRESS_LIST;
  const progressKey =
    profileId && courseId ? courseKeys.progress(profileId, courseId) : null;

  const completedIds = useMemo(
    () => getCompletedLessonIds(visibleLessons, progressList),
    [progressList, visibleLessons],
  );
  const progressPercent = useMemo(
    () => computeProgressPercent(visibleLessons, progressList),
    [progressList, visibleLessons],
  );
  const nextLesson = useMemo(
    () => getNextLesson(visibleLessons, progressList),
    [progressList, visibleLessons],
  );

  const refresh = useCallback(async () => {
    if (!courseId || !profileId) return null;
    const result = await progressQuery.refetch();
    return result.data ?? [];
  }, [courseId, profileId, progressQuery]);

  const setProgressList: Dispatch<SetStateAction<LessonProgress[]>> =
    useCallback(
      (update) => {
        if (!progressKey) return;
        queryClient.setQueryData<LessonProgress[]>(progressKey, (previous) =>
          typeof update === "function"
            ? update(previous ?? EMPTY_PROGRESS_LIST)
            : update,
        );
      },
      [progressKey, queryClient],
    );

  return {
    progressList,
    completedIds,
    progressPercent,
    nextLesson,
    refresh,
    setProgressList,
  };
}
