import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, BookOpen, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";
import { verifySePayPayment } from "@/lib/payments";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";

type StoredCheckout = {
  orderId?: string;
  courseId?: string;
  purpose?: string;
  createdAt?: number;
};

async function waitForActiveSession(maxMs: number): Promise<Session | null> {
  const {
    data: { session: initial },
  } = await supabase.auth.getSession();
  if (initial?.user) return initial;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      subscription.unsubscribe();
      resolve(null);
    }, maxMs);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        window.clearTimeout(timer);
        subscription.unsubscribe();
        resolve(session);
      }
    });
  });
}

type VerificationState = "verifying" | "success" | "invalid_order" | "timeout";

export default function CheckoutSuccess() {
  const { t } = useTranslation("courses");
  const { user: storeUser } = useAuth();
  const { courseId, purpose } = useParams<{ courseId: string; purpose: string }>();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(10);
  const hasCheckoutContext = !!courseId && !!purpose;
  const [verificationState, setVerificationState] = useState<VerificationState>(() =>
    hasCheckoutContext ? "verifying" : "invalid_order",
  );
  const [statusMessage, setStatusMessage] = useState(() =>
    hasCheckoutContext
      ? t("detail.checkoutSuccess.verifyingPayment")
      : t("detail.checkoutSuccess.missingOrderInfo"),
  );
  const targetPath = useMemo(() => {
    if (!courseId) return "/courses";
    if (purpose === "certificate_fee") return `/learn/${courseId}?payment=success`;
    return `/courses/${courseId}?payment=success`;
  }, [courseId, purpose]);

  useEffect(() => {
    const isVerifying = verificationState === "verifying";
    const timer = window.setInterval(() => {
      setSeconds((s) => (isVerifying ? s : Math.max(0, s - 1)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [verificationState]);

  useEffect(() => {
    if (!courseId || !purpose) {
      setVerificationState("invalid_order");
      return;
    }

    let cancelled = false;
    let stored: StoredCheckout | null = null;
    try {
      const raw = window.sessionStorage.getItem("corelia:lastCheckout");
      stored = raw ? (JSON.parse(raw) as StoredCheckout) : null;
    } catch {
      stored = null;
    }
    const orderId =
      stored?.courseId === courseId && stored?.purpose === purpose ? stored.orderId : undefined;

    void (async () => {
      setStatusMessage(t("detail.checkoutSuccess.restoringSession"));
      let session =
        storeUser != null
          ? (await supabase.auth.getSession()).data.session
          : null;
      if (!session?.user) {
        session = await waitForActiveSession(30_000);
      }
      if (cancelled) return;

      const accessToken = session?.access_token ?? null;
      if (!accessToken) {
        setVerificationState(orderId ? "timeout" : "invalid_order");
        setStatusMessage(
          t("detail.checkoutSuccess.sessionNotReady"),
        );
        return;
      }

      setStatusMessage(t("detail.checkoutSuccess.verifyingPayment"));
      const deadline = Date.now() + 30_000;
      while (!cancelled && Date.now() < deadline) {
        try {
          const result = await verifySePayPayment({
            orderId,
            courseId,
            purpose: purpose === "certificate_fee" ? "certificate_fee" : "course_purchase",
            accessToken,
          });
          if (cancelled) return;
          if (result.full_access_granted || result.certificate_fee_paid) {
            setVerificationState("success");
            setStatusMessage(
              result.verified_by === "sepay_lookup"
                ? t("detail.checkoutSuccess.verifiedViaSePay")
                : t("detail.checkoutSuccess.verifiedFallback"),
            );
            window.sessionStorage.removeItem("corelia:lastCheckout");
            return;
          }
          if (!orderId) {
            // No order to verify and user doesn't have existing access -> invalid order
            setVerificationState("invalid_order");
            setStatusMessage(t("detail.checkoutSuccess.missingOrderInfo"));
            return;
          }
          setStatusMessage(t("detail.checkoutSuccess.waitingForAccess"));
        } catch (error) {
          if (cancelled) return;
          if (!orderId) {
            setVerificationState("invalid_order");
            setStatusMessage(t("detail.checkoutSuccess.missingOrderInfo"));
            return;
          }
          setStatusMessage(
            error instanceof Error
              ? error.message
              : t("detail.checkoutSuccess.verifyFailedFallback"),
          );
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      if (!cancelled) {
        setVerificationState(orderId ? "timeout" : "invalid_order");
        setStatusMessage(
          orderId
            ? t("detail.checkoutSuccess.timeoutStatus")
            : t("detail.checkoutSuccess.missingOrderInfo"),
        );
        if (orderId) {
          toast.message(
            t("detail.checkoutSuccess.timeoutToast"),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, purpose, storeUser, t]);

  useEffect(() => {
    if (verificationState !== "success" || seconds > 0) return;
    navigate(targetPath, { replace: true });
  }, [seconds, targetPath, navigate, verificationState]);

  const title =
    verificationState === "success"
      ? t("detail.checkoutSuccess.title")
      : verificationState === "verifying"
        ? t("detail.checkoutSuccess.verifyingTitle", "Đang xác nhận thanh toán...")
        : verificationState === "timeout"
          ? t("detail.checkoutSuccess.timeoutTitle", "Chưa hoàn tất xác nhận thanh toán")
          : t("detail.checkoutSuccess.invalidOrderTitle", "Không tìm thấy thông tin đơn hàng");

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-10">
      <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
        <h1 className="text-2xl font-normal tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          {statusMessage}{" "}
          {verificationState === "success" ? (
            <>
              {t("detail.checkoutSuccess.autoRedirectPrefix")}{" "}
              <span className="font-medium text-foreground tabular-nums">{seconds}s</span>.
            </>
          ) : null}
        </p>

        {verificationState === "verifying" ? (
          <div className="mt-6 flex items-center justify-center">
            <Loader2 className="size-10 animate-spin text-foreground-subtle" aria-hidden />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {verificationState === "invalid_order" ? (
            <>
              <Button
                className="sm:w-auto w-full"
                size="lg"
                onClick={() => navigate("/courses")}
              >
                {t("detail.checkoutSuccess.backToCourses", "Về danh sách khoá học")}
              </Button>
              <Button
                className="sm:w-auto w-full"
                size="lg"
                variant="outline"
                onClick={() => navigate("/account/billing")}
              >
                <Receipt className="size-4" aria-hidden /> {t("detail.checkoutSuccess.viewBilling")}
              </Button>
            </>
          ) : (
            <>
              <Button
                className="sm:w-auto w-full"
                size="lg"
                onClick={() => navigate("/account/billing")}
              >
                <Receipt className="size-4" aria-hidden /> {t("detail.checkoutSuccess.viewBilling")}
              </Button>
              <Button
                className="sm:w-auto w-full"
                size="lg"
                variant={verificationState === "success" ? "default" : "outline"}
                onClick={() => navigate(targetPath)}
              >
                <BookOpen className="size-4" aria-hidden /> {t("detail.checkoutSuccess.goToCourse")}
              </Button>
            </>
          )}
        </div>

        {verificationState === "success" && (
          <div className="mt-6 text-xs text-foreground-muted">
            <Link to={targetPath} className="inline-flex items-center gap-1 hover:underline">
              {t("detail.checkoutSuccess.skipNow")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
