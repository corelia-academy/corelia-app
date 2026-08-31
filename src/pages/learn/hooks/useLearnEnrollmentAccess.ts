import { useEffect, useState } from "react";
import { getEnrollment } from "@/lib/courses";
import type { Enrollment } from "@/types/courses";

interface UseLearnEnrollmentAccessInput {
  courseId: string | undefined;
  profileId: string | undefined;
}

interface UseLearnEnrollmentAccessResult {
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
  const [enrolled, setEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const hasContext = !!courseId && !!profileId;

  useEffect(() => {
    if (!courseId || !profileId) return;
    let cancelled = false;
    getEnrollment(profileId, courseId).then((enrollmentRow) => {
      if (cancelled) return;
      setEnrolled(!!enrollmentRow);
      setEnrollment(enrollmentRow ?? null);
    }).catch(() => {
      if (cancelled) return;
      setEnrolled(false);
      setEnrollment(null);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, profileId]);

  const effectiveEnrolled = hasContext ? enrolled : false;
  const effectiveEnrollment = hasContext ? enrollment : null;
  return {
    enrolled: effectiveEnrolled,
    enrollment: effectiveEnrollment,
    hasFullCourseAccess: true,
    setEnrolled,
    setEnrollment,
  };
}
