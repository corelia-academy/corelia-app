import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, BookOpen, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { verifySePayPayment } from "@/lib/payments";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type StoredCheckout = {
  orderId?: string;
  courseId?: string;
  purpose?: string;
  createdAt?: number;
};

async function waitForSupabaseUser(maxMs: number): Promise<boolean> {
  const started = Date.now();
  let interval = 100;
  while (Date.now() - started < maxMs) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return true;
    await new Promise((r) => window.setTimeout(r, interval));
    interval = Math.min(500, interval + 50);
  }
  return false;
}

export default function CheckoutSuccess() {
  const { t } = useTranslation("courses");
  const { courseId, purpose } = useParams<{ courseId: string; purpose: string }>();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(10);
  const hasCheckoutContext = !!courseId && !!purpose;
  const [verifying, setVerifying] = useState(hasCheckoutContext);
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
    const t = window.setInterval(() => {
      setSeconds((s) => (verifying ? s : Math.max(0, s - 1)));
    }, 1000);
    return () => window.clearInterval(t);
  }, [verifying]);

  useEffect(() => {
    if (!courseId || !purpose) return;

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
      const hasUser = await waitForSupabaseUser(30_000);
      if (cancelled) return;

      if (!hasUser) {
        setVerifying(false);
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
          });
          if (cancelled) return;
          if (result.full_access_granted || result.certificate_fee_paid) {
            setVerifying(false);
            setStatusMessage(
              result.verified_by === "sepay_lookup"
                ? t("detail.checkoutSuccess.verifiedViaSePay")
                : t("detail.checkoutSuccess.verifiedFallback"),
            );
            window.sessionStorage.removeItem("corelia:lastCheckout");
            return;
          }
          setStatusMessage(t("detail.checkoutSuccess.waitingForAccess"));
        } catch (error) {
          if (cancelled) return;
          setStatusMessage(
            error instanceof Error
              ? error.message
              : t("detail.checkoutSuccess.verifyFailedFallback"),
          );
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      if (!cancelled) {
        setVerifying(false);
        setStatusMessage(
          t("detail.checkoutSuccess.timeoutStatus"),
        );
        toast.message(
          t("detail.checkoutSuccess.timeoutToast"),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, purpose, t]);

  useEffect(() => {
    if (verifying || seconds > 0) return;
    navigate(targetPath, { replace: true });
  }, [seconds, targetPath, navigate, verifying]);

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-10">
      <div className="rounded-md border border-border-subtle bg-card p-6">
        <h1 className="text-2xl font-normal tracking-tight text-foreground">
          {t("detail.checkoutSuccess.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {statusMessage}{" "}
          {!verifying ? (
            <>
              {t("detail.checkoutSuccess.autoRedirectPrefix")}{" "}
              <span className="font-medium text-foreground tabular-nums">{seconds}s</span>.
            </>
          ) : null}
        </p>

        {verifying ? (
          <div className="mt-6 flex items-center justify-center">
            <Loader2 className="size-10 animate-spin text-muted-foreground/60" aria-hidden />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
            variant="outline"
            onClick={() => navigate(targetPath)}
          >
            <BookOpen className="size-4" aria-hidden /> {t("detail.checkoutSuccess.goToCourse")}
          </Button>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          <Link to={targetPath} className="inline-flex items-center gap-1 hover:underline">
            {t("detail.checkoutSuccess.skipNow")} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
