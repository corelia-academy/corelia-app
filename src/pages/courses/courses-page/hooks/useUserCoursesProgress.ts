import { useQuery } from "@tanstack/react-query";

import { userCoursesProgressQueryOptions } from "@/features/courses/courseQueries";
import { useAuth } from "@/stores/authStore";

export interface CourseProgressEntry {
  enrolled: boolean;
  percent: number;
}

export function useUserCoursesProgress() {
  const { user } = useAuth();
  const query = useQuery(userCoursesProgressQueryOptions(user?.id));
  return {
    progressByCourse: query.data ?? new Map<string, CourseProgressEntry>(),
    loading: Boolean(user) && query.isPending,
  };
}
