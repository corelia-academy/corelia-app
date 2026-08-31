import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { enrollCourse, getEnrollment } from "@/lib/courses";
import type { Enrollment } from "@/types/courses";

interface UseCourseEnrollmentAccessInput {
  resolvedCourseId: string | null;
  profileId: string | undefined;
  /** Forwarded to `enrollCourse` to avoid a redundant `auth.getUser()`. */
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
  const [enrolled, setEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!resolvedCourseId || !profileId) {
      setEnrolled(false);
      setEnrollment(null);
      return;
    }
    let cancelled = false;

    getEnrollment(profileId, resolvedCourseId)
      .then((enrollmentRow) => {
        if (cancelled) return;
        setEnrolled(!!enrollmentRow);
        setEnrollment(enrollmentRow ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setEnrolled(false);
        setEnrollment(null);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedCourseId, profileId]);

  const runEnroll = useCallback(async () => {
    if (!resolvedCourseId) return null;
    setEnrolling(true);
    try {
      const row = await enrollCourse(resolvedCourseId, viewer);
      setEnrolled(true);
      setEnrollment(row);
      return row;
    } finally {
      setEnrolling(false);
    }
  }, [resolvedCourseId, viewer]);

  return {
    enrolled,
    enrollment,
    enrolling,
    runEnroll,
    setEnrolled,
    setEnrollment,
  };
}
