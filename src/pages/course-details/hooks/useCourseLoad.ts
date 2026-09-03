import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import i18n from "@/i18n";
import { courseBundleQueryOptions } from "@/features/courses/courseQueries";
import type { Course, CourseLesson, CourseSection } from "@/types/courses";

interface UseCourseLoadInput {
  idOrSlug: string | undefined;
  missingIdMessage: string;
  loadCourseErrorFallback: string;
  /** When set, avoids an extra `auth.getUser()` when resolving draft course by slug. */
  viewer?: User | null;
}

interface UseCourseLoadResult {
  course: Course | null;
  sections: CourseSection[];
  lessons: CourseLesson[];
  resolvedCourseId: string | null;
  loading: boolean;
  error: string | null;
  setError: (next: string | null) => void;
}

export function useCourseLoad({
  idOrSlug,
  missingIdMessage,
  loadCourseErrorFallback,
  viewer,
}: UseCourseLoadInput): UseCourseLoadResult {
  const navigate = useNavigate();
  const requestKey = `${idOrSlug ?? "missing"}:${i18n.language}:${viewer?.id ?? "anonymous"}`;
  const [manualError, setManualError] = useState<{
    requestKey: string;
    message: string | null;
  }>({ requestKey: "", message: null });
  const query = useQuery(
    courseBundleQueryOptions({
      courseRef: idOrSlug,
      locale: i18n.language,
      viewer: viewer ?? null,
    }),
  );

  useEffect(() => {
    const canonicalSlug = query.data?.canonicalSlug;
    if (canonicalSlug && idOrSlug !== canonicalSlug) {
      navigate(`/courses/${canonicalSlug}`, { replace: true });
    }
  }, [idOrSlug, navigate, query.data?.canonicalSlug]);

  const setError = useCallback(
    (message: string | null) => setManualError({ requestKey, message }),
    [requestKey],
  );
  const queryError = query.error
    ? query.error instanceof Error
      ? query.error.message
      : loadCourseErrorFallback
    : null;
  const effectiveError = !idOrSlug
    ? missingIdMessage
    : manualError.requestKey === requestKey
      ? manualError.message ?? queryError
      : queryError;

  return {
    course: query.data?.course ?? null,
    sections: query.data?.sections ?? [],
    lessons: query.data?.lessons ?? [],
    resolvedCourseId: query.data?.resolvedCourseId ?? null,
    loading: Boolean(idOrSlug) && query.isPending,
    error: effectiveError,
    setError,
  };
}
