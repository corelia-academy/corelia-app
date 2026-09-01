import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  courseEnrollmentQueryOptions,
  courseKeys,
} from "@/features/courses/courseQueries";
import type { Enrollment } from "@/types/courses";

interface UseLearnEnrollmentAccessInput {
  courseId: string | undefined;
  profileId: string | undefined;
}

interface UseLearnEnrollmentAccessResult {
  loading: boolean;
  enrolled: boolean;
  enrollment: Enrollment | null;
  hasFullCourseAccess: boolean;
  setEnrolled: (value: boolean) => void;
  setEnrollment: (value: Enrollment | null) => void;
}

export function useLearnEnrollmentAccess({
  courseId,
  profileId,
}: UseLearnEnrollmentAccessInput): UseLearnEnrollmentAccessResult {
  const hasContext = Boolean(courseId && profileId);
  const queryClient = useQueryClient();
  const enrollmentQuery = useQuery(
    courseEnrollmentQueryOptions(profileId, courseId),
  );
  const enrollmentKey =
    profileId && courseId ? courseKeys.enrollment(profileId, courseId) : null;
  const setEnrollment = useCallback(
    (value: Enrollment | null) => {
      if (enrollmentKey) queryClient.setQueryData(enrollmentKey, value);
    },
    [enrollmentKey, queryClient],
  );
  const setEnrolled = useCallback(
    (value: boolean) => {
      if (!value) setEnrollment(null);
    },
    [setEnrollment],
  );

  return {
    loading: hasContext && enrollmentQuery.isPending,
    enrolled: Boolean(enrollmentQuery.data),
    enrollment: enrollmentQuery.data ?? null,
    hasFullCourseAccess: true,
    setEnrolled,
    setEnrollment,
  };
}
