import { useQuery } from "@tanstack/react-query";

import { instructorProfileQueryOptions } from "@/features/courses/courseQueries";

export function useInstructorProfile(instructorId: string | undefined) {
  const query = useQuery(instructorProfileQueryOptions(instructorId));
  return {
    profile: query.data ?? null,
    loading: Boolean(instructorId) && query.isPending,
  };
}
