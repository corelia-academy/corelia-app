import { useEffect, useMemo, useRef, useState } from "react";
import { getEnrollment } from "@/lib/courses";
import {
  getCoursePaymentAccess,
  type CoursePaymentAccess,
} from "@/lib/payments";
import type { Enrollment } from "@/types/courses";

interface UseLearnEnrollmentAccessInput {
  courseId: string | undefined;
  profileId: string | undefined;
  accessModel: string | undefined;
  role: string | undefined;
}

interface UseLearnEnrollmentAccessResult {
  loading: boolean;
  enrolled: boolean;
  enrollment: Enrollment | null;
  paymentAccess: CoursePaymentAccess | null;
  hasFullCourseAccess: boolean;
  setEnrolled: (value: boolean) => void;
  setEnrollment: (value: Enrollment | null) => void;
  setPaymentAccess: (value: CoursePaymentAccess | null) => void;
}

interface FetchedAccessContext {
  courseId: string;
  profileId: string;
  enrolled: boolean;
  enrollment: Enrollment | null;
  paymentAccess: CoursePaymentAccess | null;
}

export function useLearnEnrollmentAccess({
  courseId,
  profileId,
  accessModel,
  role,
}: UseLearnEnrollmentAccessInput): UseLearnEnrollmentAccessResult {
  const hasContext = Boolean(courseId && profileId);
  const [dataContext, setDataContext] = useState<FetchedAccessContext | null>(null);
  const [loading, setLoading] = useState(() => hasContext);

  const activeContextRef = useRef({ courseId, profileId });

  const currentCourseId = courseId;
  const currentProfileId = profileId;

  useEffect(() => {
    activeContextRef.current = { courseId, profileId };
  }, [courseId, profileId]);

  useEffect(() => {
    if (!courseId || !profileId) return;
    let cancelled = false;
    const targetCourseId = courseId;
    const targetProfileId = profileId;

    Promise.all([
      getEnrollment(targetProfileId, targetCourseId),
      getCoursePaymentAccess(targetProfileId, targetCourseId),
    ])
      .then(([enrollmentRow, paymentRow]) => {
        if (cancelled) return;
        setDataContext({
          courseId: targetCourseId,
          profileId: targetProfileId,
          enrolled: Boolean(enrollmentRow),
          enrollment: enrollmentRow ?? null,
          paymentAccess: paymentRow ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setDataContext({
          courseId: targetCourseId,
          profileId: targetProfileId,
          enrolled: false,
          enrollment: null,
          paymentAccess: null,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, profileId]);

  const matchesContext =
    hasContext &&
    dataContext?.courseId === courseId &&
    dataContext?.profileId === profileId;

  const isCurrentLoading = hasContext ? !matchesContext || loading : false;
  const effectiveEnrolled = matchesContext && dataContext ? dataContext.enrolled : false;
  const effectiveEnrollment = matchesContext && dataContext ? dataContext.enrollment : null;
  const effectivePaymentAccess = matchesContext && dataContext ? dataContext.paymentAccess : null;

  const hasFullCourseAccess = useMemo(() => {
    const effective = accessModel ?? "free";
    if (effective !== "paid_upfront") return true;
    if (role === "admin") return true;
    if (!matchesContext) return false;

    const isRevoked =
      effectivePaymentAccess?.status === "revoked" ||
      effectivePaymentAccess?.status === "expired";
    if (isRevoked) return false;

    return (
      effectivePaymentAccess?.full_access_granted === true ||
      (effectiveEnrolled && Boolean(effectiveEnrollment?.paid_at))
    );
  }, [
    accessModel,
    effectiveEnrolled,
    effectiveEnrollment?.paid_at,
    effectivePaymentAccess?.full_access_granted,
    effectivePaymentAccess?.status,
    matchesContext,
    role,
  ]);

  return {
    loading: isCurrentLoading,
    enrolled: effectiveEnrolled,
    enrollment: effectiveEnrollment,
    paymentAccess: effectivePaymentAccess,
    hasFullCourseAccess,
    setEnrolled: (value: boolean) => {
      if (
        !currentCourseId ||
        !currentProfileId ||
        activeContextRef.current.courseId !== currentCourseId ||
        activeContextRef.current.profileId !== currentProfileId
      ) {
        return;
      }
      setDataContext((prev) => {
        const isSameContext =
          prev?.courseId === currentCourseId && prev?.profileId === currentProfileId;
        return {
          courseId: currentCourseId,
          profileId: currentProfileId,
          enrolled: value,
          enrollment: isSameContext ? prev.enrollment : null,
          paymentAccess: isSameContext ? prev.paymentAccess : null,
        };
      });
    },
    setEnrollment: (value: Enrollment | null) => {
      if (
        !currentCourseId ||
        !currentProfileId ||
        activeContextRef.current.courseId !== currentCourseId ||
        activeContextRef.current.profileId !== currentProfileId
      ) {
        return;
      }
      setDataContext((prev) => {
        const isSameContext =
          prev?.courseId === currentCourseId && prev?.profileId === currentProfileId;
        return {
          courseId: currentCourseId,
          profileId: currentProfileId,
          enrolled: isSameContext ? prev.enrolled : false,
          enrollment: value,
          paymentAccess: isSameContext ? prev.paymentAccess : null,
        };
      });
    },
    setPaymentAccess: (value: CoursePaymentAccess | null) => {
      if (
        !currentCourseId ||
        !currentProfileId ||
        activeContextRef.current.courseId !== currentCourseId ||
        activeContextRef.current.profileId !== currentProfileId
      ) {
        return;
      }
      setDataContext((prev) => {
        const isSameContext =
          prev?.courseId === currentCourseId && prev?.profileId === currentProfileId;
        return {
          courseId: currentCourseId,
          profileId: currentProfileId,
          enrolled: isSameContext ? prev.enrolled : false,
          enrollment: isSameContext ? prev.enrollment : null,
          paymentAccess: value,
        };
      });
    },
  };
}
