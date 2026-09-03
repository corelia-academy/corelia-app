import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { useCallback } from "react";

import {
  courseEnrollmentQueryOptions,
  courseKeys,
} from "@/features/courses/courseQueries";
import { enrollCourse } from "@/lib/courses";
import type { Enrollment } from "@/types/courses";

interface UseCourseEnrollmentAccessInput {
  resolvedCourseId: string | null;
  profileId: string | undefined;
  viewer?: User | null;
}

interface UseCourseEnrollmentAccessResult {
  enrolled: boolean;
  enrollment: Enrollment | null;
  enrolling: boolean;
  runEnroll: () => Promise<Enrollment | null>;
  setEnrolled: (value: boolean) => void;
  setEnrollment: (value: Enrollment | null) => void;
}

export function useCourseEnrollmentAccess({
  resolvedCourseId,
  profileId,
  viewer,
}: UseCourseEnrollmentAccessInput): UseCourseEnrollmentAccessResult {
  const queryClient = useQueryClient();
  const enrollmentQuery = useQuery(
    courseEnrollmentQueryOptions(profileId, resolvedCourseId),
  );
  const enrollmentKey =
    profileId && resolvedCourseId
      ? courseKeys.enrollment(profileId, resolvedCourseId)
      : null;
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedCourseId) return null;
      return enrollCourse(resolvedCourseId, viewer);
    },
    onSuccess: (row) => {
      if (enrollmentKey && row) queryClient.setQueryData(enrollmentKey, row);
    },
  });

  const runEnroll = useCallback(
    () => enrollMutation.mutateAsync(),
    [enrollMutation],
  );
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
    enrolled: Boolean(enrollmentQuery.data),
    enrollment: enrollmentQuery.data ?? null,
    enrolling: enrollMutation.isPending,
    runEnroll,
    setEnrolled,
    setEnrollment,
  };
}
