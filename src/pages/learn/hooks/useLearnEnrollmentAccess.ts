import { useEffect, useMemo, useState } from "react";
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
  enrolled: boolean;
  enrollment: Enrollment | null;
  paymentAccess: CoursePaymentAccess | null;
  hasFullCourseAccess: boolean;
  setEnrolled: (value: boolean) => void;
  setEnrollment: (value: Enrollment | null) => void;
  setPaymentAccess: (value: CoursePaymentAccess | null) => void;
}

export function useLearnEnrollmentAccess({
  courseId,
  profileId,
  accessModel,
  role,
}: UseLearnEnrollmentAccessInput): UseLearnEnrollmentAccessResult {
  const [enrolled, setEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [paymentAccess, setPaymentAccess] =
    useState<CoursePaymentAccess | null>(null);
  const hasContext = !!courseId && !!profileId;

  useEffect(() => {
    if (!courseId || !profileId) return;
    let cancelled = false;
    Promise.all([
      getEnrollment(profileId, courseId),
      getCoursePaymentAccess(profileId, courseId),
    ]).then(([enrollmentRow, paymentRow]) => {
      if (cancelled) return;
      setEnrolled(!!enrollmentRow);
      setEnrollment(enrollmentRow ?? null);
      setPaymentAccess(paymentRow ?? null);
    }).catch(() => {
      if (cancelled) return;
      setEnrolled(false);
      setEnrollment(null);
      setPaymentAccess(null);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, profileId]);

  const effectiveEnrolled = hasContext ? enrolled : false;
  const effectiveEnrollment = hasContext ? enrollment : null;
  const effectivePaymentAccess = hasContext ? paymentAccess : null;

  const hasFullCourseAccess = useMemo(() => {
    const effective = accessModel ?? "free";
    return (
      effective !== "paid_upfront" ||
      effectiveEnrolled ||
      !!effectivePaymentAccess?.full_access_granted ||
      role === "admin"
    );
  }, [
    accessModel,
    effectiveEnrolled,
    effectivePaymentAccess?.full_access_granted,
    role,
  ]);

  return {
    enrolled: effectiveEnrolled,
    enrollment: effectiveEnrollment,
    paymentAccess: effectivePaymentAccess,
    hasFullCourseAccess,
    setEnrolled,
    setEnrollment,
    setPaymentAccess,
  };
}
