import { useEffect, useRef, useState } from "react";
import { getEnrollment } from "@/lib/courses";
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

interface FetchedAccessContext {
  courseId: string;
  profileId: string;
  enrolled: boolean;
  enrollment: Enrollment | null;
}

export function useLearnEnrollmentAccess({
  courseId,
  profileId,
}: UseLearnEnrollmentAccessInput): UseLearnEnrollmentAccessResult {
  const hasContext = Boolean(courseId && profileId);
  const [dataContext, setDataContext] = useState<FetchedAccessContext | null>(null);
  const activeContextRef = useRef({ courseId, profileId });

  useEffect(() => {
    activeContextRef.current = { courseId, profileId };
  }, [courseId, profileId]);

  useEffect(() => {
    if (!courseId || !profileId) return;
    let cancelled = false;
    const targetCourseId = courseId;
    const targetProfileId = profileId;

    getEnrollment(targetProfileId, targetCourseId)
      .then((enrollmentRow) => {
        if (cancelled) return;
        setDataContext({
          courseId: targetCourseId,
          profileId: targetProfileId,
          enrolled: Boolean(enrollmentRow),
          enrollment: enrollmentRow ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setDataContext({
          courseId: targetCourseId,
          profileId: targetProfileId,
          enrolled: false,
          enrollment: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, profileId]);

  const matchesContext =
    hasContext &&
    dataContext?.courseId === courseId &&
    dataContext?.profileId === profileId;
  const matchedContext = matchesContext ? dataContext : null;
  const currentCourseId = courseId;
  const currentProfileId = profileId;

  const updateCurrentContext = (
    update: (previous: FetchedAccessContext | null) => FetchedAccessContext,
  ) => {
    if (
      !currentCourseId ||
      !currentProfileId ||
      activeContextRef.current.courseId !== currentCourseId ||
      activeContextRef.current.profileId !== currentProfileId
    ) {
      return;
    }
    setDataContext(update);
  };

  return {
    loading: hasContext ? !matchesContext : false,
    enrolled: matchedContext?.enrolled ?? false,
    enrollment: matchedContext?.enrollment ?? null,
    hasFullCourseAccess: true,
    setEnrolled: (value) => {
      updateCurrentContext((previous) => ({
        courseId: currentCourseId!,
        profileId: currentProfileId!,
        enrolled: value,
        enrollment:
          previous?.courseId === currentCourseId &&
          previous?.profileId === currentProfileId
            ? previous?.enrollment ?? null
            : null,
      }));
    },
    setEnrollment: (value) => {
      updateCurrentContext((previous) => ({
        courseId: currentCourseId!,
        profileId: currentProfileId!,
        enrolled:
          previous?.courseId === currentCourseId &&
          previous?.profileId === currentProfileId
            ? previous?.enrolled ?? false
            : Boolean(value),
        enrollment: value,
      }));
    },
  };
}
