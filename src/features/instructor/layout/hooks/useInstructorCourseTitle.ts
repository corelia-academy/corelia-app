import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  instructorCourseTitleQueryOptions,
  instructorKeys,
} from "@/features/instructor/instructorQueries";

export function useInstructorCourseTitle({
  id,
  enabled,
}: {
  id?: string;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery(instructorCourseTitleQueryOptions(id, enabled));
  const setCourseTitle = useCallback(
    (title: string | null) => {
      if (id) queryClient.setQueryData(instructorKeys.courseTitle(id), title);
    },
    [id, queryClient],
  );
  return { courseTitle: query.data ?? null, setCourseTitle };
}
