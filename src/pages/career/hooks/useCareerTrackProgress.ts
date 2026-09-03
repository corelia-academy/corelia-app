import { useQuery } from "@tanstack/react-query";

import {
  careerProgressQueryOptions,
  type CareerCourseProgress,
} from "@/features/career/careerQueries";

export type { CareerCourseProgress };

export function useCareerTrackProgress(
  courseIds: string[],
  userId: string | undefined,
) {
  const query = useQuery(careerProgressQueryOptions(courseIds, userId));
  return {
    progressByCourse: query.data ?? new Map<string, CareerCourseProgress>(),
    loading: Boolean(userId && courseIds.length) && query.isPending,
  };
}
