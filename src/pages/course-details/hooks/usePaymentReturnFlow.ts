import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { getEnrollment } from "@/lib/courses";
import {
  getCoursePaymentAccess,
  type CoursePaymentAccess,
} from "@/lib/payments";
import type { Enrollment } from "@/types/courses";

type PaymentQuery = "success" | "error" | "cancel" | null;

interface UsePaymentReturnFlowInput {
  resolvedCourseId: string | null;
  profileId: string | undefined;
  paymentAccessFullAccessGranted: boolean | undefined;
  setPaymentAccess: (value: CoursePaymentAccess | null) => void;
  setEnrolled: (value: boolean) => void;
  setEnrollment: (value: Enrollment | null) => void;
  translate: (key: string, options?: Record<string, unknown>) => string;
}

export function usePaymentReturnFlow({
  resolvedCourseId,
  profileId,
  paymentAccessFullAccessGranted,
  setPaymentAccess,
  setEnrolled,
  setEnrollment,
  translate,
}: UsePaymentReturnFlowInput): void {
  const location = useLocation();
  const navigate = useNavigate();

  const paymentQuery = useMemo<PaymentQuery>(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get("payment");
    return payment === "success" || payment === "error" || payment === "cancel"
      ? payment
      : null;
  }, [location.search]);

  useEffect(() => {
    if (!resolvedCourseId || !profileId || !paymentQuery) return;
    let cancelled = false;

    const clearPaymentQuery = () => {
      const params = new URLSearchParams(location.search);
      params.delete("payment");
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true },
      );
    };

    if (paymentQuery === "error") {
      toast.error(translate("detail.payment.failed"));
      clearPaymentQuery();
      return;
    }

    if (paymentQuery === "cancel") {
      void (async () => {
        const latestPaymentAccess = await getCoursePaymentAccess(
          profileId,
          resolvedCourseId,
        ).catch(() => null);
        const latestEnrollment = await getEnrollment(
          profileId,
          resolvedCourseId,
        ).catch(() => null);
        if (cancelled) return;
        if (latestPaymentAccess) {
          setPaymentAccess(latestPaymentAccess);
        }
        if (latestEnrollment) {
          setEnrolled(true);
          setEnrollment(latestEnrollment);
        }
        if (latestPaymentAccess?.full_access_granted || !!latestEnrollment) {
          clearPaymentQuery();
          return;
        }
        toast.message(translate("detail.payment.cancelled"));
        clearPaymentQuery();
      })();
      return;
    }

    toast.message(translate("detail.payment.checking"));
    void (async () => {
      const deadline = Date.now() + 20_000;
      while (!cancelled && Date.now() < deadline) {
        const pay = await getCoursePaymentAccess(
          profileId,
          resolvedCourseId,
        ).catch(() => null);
        if (cancelled) return;
        if (pay?.full_access_granted) {
          setPaymentAccess(pay);
          toast.success(translate("detail.payment.success"));
          clearPaymentQuery();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelled) {
        toast.message(translate("detail.payment.notConfirmedYet"));
        clearPaymentQuery();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    resolvedCourseId,
    location.pathname,
    location.search,
    navigate,
    paymentAccessFullAccessGranted,
    paymentQuery,
    profileId,
    translate,
    setEnrolled,
    setEnrollment,
    setPaymentAccess,
  ]);
}
