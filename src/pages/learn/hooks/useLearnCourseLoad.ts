import type { User } from "@supabase/supabase-js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { touchEnrollment } from "@/lib/courses";
import i18n from "@/i18n";
import { courseBundleQueryOptions } from "@/features/courses/courseQueries";
import type { Course, CourseLesson, CourseSection } from "@/types/courses";

interface UseLearnCourseLoadInput {
  courseId: string | undefined;
  loadCourseErrorFallback: string;
  viewer?: User | null;
}

interface UseLearnCourseLoadResult {
  course: Course | null;
  sections: CourseSection[];
  lessons: CourseLesson[];
  loading: boolean;
  error: string | null;
  setError: (next: string | null) => void;
}

export function useLearnCourseLoad({
  courseId,
  loadCourseErrorFallback,
  viewer,
}: UseLearnCourseLoadInput): UseLearnCourseLoadResult {
  const requestKey = `${courseId ?? "missing"}:${i18n.language}:${viewer?.id ?? "anonymous"}`;
  const [manualError, setManualError] = useState<{
    requestKey: string;
    message: string | null;
  }>({ requestKey: "", message: null });
  const query = useQuery(
    courseBundleQueryOptions({
      courseRef: courseId,
      locale: i18n.language,
      viewer: viewer ?? null,
    }),
  );
  const touchMutation = useMutation({
    mutationFn: ({ id, user }: { id: string; user: User | null }) =>
      touchEnrollment(id, user),
  });

  useEffect(() => {
    if (!courseId) return;
    touchMutation.mutate({ id: courseId, user: viewer ?? null });
  // Touching last_accessed_at is a route-entry side effect, not a read cache.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, viewer?.id]);

  const setError = useCallback(
    (message: string | null) => setManualError({ requestKey, message }),
    [requestKey],
  );
  const queryError = query.error
    ? query.error instanceof Error
      ? query.error.message
      : loadCourseErrorFallback
    : null;
  const error =
    manualError.requestKey === requestKey
      ? manualError.message ?? queryError
      : queryError;

  return {
    course: query.data?.course ?? null,
    sections: query.data?.sections ?? [],
    lessons: query.data?.lessons ?? [],
    loading: Boolean(courseId) && query.isPending,
    error,
    setError,
  };
}
