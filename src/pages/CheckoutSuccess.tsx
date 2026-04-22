import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Receipt, BookOpen } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { verifySePayPayment } from "@/lib/payments";
import { toast } from "sonner";

type StoredCheckout = {
  orderId?: string;
  courseId?: string;
  purpose?: string;
  createdAt?: number;
};

export default function CheckoutSuccess() {
  const { courseId, purpose } = useParams<{ courseId: string; purpose: string }>();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(10);
  const hasCheckoutContext = !!courseId && !!purpose;
  const [verifying, setVerifying] = useState(hasCheckoutContext);
  const [statusMessage, setStatusMessage] = useState(() =>
    hasCheckoutContext
      ? "Đang xác nhận thanh toán và quyền truy cập khoá học..."
      : "Thiếu thông tin đơn hàng để xác minh tự động.",
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
      setStatusMessage("Đang khôi phục phiên đăng nhập...");
      await auth.authStateReady();
      if (cancelled) return;

      if (!auth.currentUser) {
        setVerifying(false);
        setStatusMessage(
          "Phiên đăng nhập chưa sẵn sàng trên thiết bị này. Bạn vẫn có thể vào khoá học để hệ thống kiểm tra lại quyền truy cập.",
        );
        return;
      }

      setStatusMessage("Đang xác nhận thanh toán và quyền truy cập khoá học...");
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
                ? "Đã xác minh thanh toán từ cổng SePay và mở quyền truy cập."
                : "Đã xác nhận thanh toán và mở quyền truy cập thành công.",
            );
            window.sessionStorage.removeItem("corelia:lastCheckout");
            return;
          }
          setStatusMessage("Đã ghi nhận giao dịch. Hệ thống đang chờ xác nhận quyền truy cập...");
        } catch (error) {
          if (cancelled) return;
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "Không thể xác minh thanh toán ngay lúc này.",
          );
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      if (!cancelled) {
        setVerifying(false);
        setStatusMessage(
          "Chưa xác minh xong trong thời gian chờ. Bạn vẫn có thể vào khoá học, hệ thống sẽ tiếp tục kiểm tra ở bước tiếp theo.",
        );
        toast.message(
          "Chưa xác minh xong thanh toán. Hệ thống sẽ kiểm tra lại khi bạn vào khoá học.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, purpose]);

  useEffect(() => {
    if (verifying || seconds > 0) return;
    navigate(targetPath, { replace: true });
  }, [seconds, targetPath, navigate, verifying]);

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-10">
      <div className="rounded-lg border border-border-subtle bg-card p-6">
        <h1 className="text-2xl font-normal tracking-tight text-foreground">
          Thanh toán thành công
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {statusMessage}{" "}
          {!verifying ? (
            <>
              Hệ thống sẽ tự chuyển sau{" "}
              <span className="font-medium text-foreground tabular-nums">{seconds}s</span>.
            </>
          ) : null}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            className="sm:w-auto w-full"
            size="lg"
            onClick={() => navigate("/account/billing")}
          >
            <Receipt className="size-4" /> Xem lịch sử thanh toán
          </Button>
          <Button
            className="sm:w-auto w-full"
            size="lg"
            variant="outline"
            onClick={() => navigate(targetPath)}
          >
            <BookOpen className="size-4" /> Vào khoá học
          </Button>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          <Link to={targetPath} className="inline-flex items-center gap-1 hover:underline">
            Bỏ qua và chuyển ngay <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
