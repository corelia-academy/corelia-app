import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { enrollCourse, getCourse } from "@/lib/courses";
import { createSePayCheckout, completeSePayCheckout } from "@/lib/payments";
import type { Course } from "@/types/courses";
import { formatVndPrice } from "@/types/courses";
import { intlLocale } from "@/lib/intl";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function computeDisplayPrice(course: Course) {
  const base = Number(course.price_vnd || 0);
  const promo = Number(course.promo_price_vnd || 0);
  const endsAt = course.promo_ends_at ? Date.parse(course.promo_ends_at) : NaN;
  const promoActive =
    base > 0 &&
    promo > 0 &&
    promo < base &&
    (!Number.isFinite(endsAt) || Date.now() <= endsAt);
  return {
    base,
    promo,
    promoActive,
    promoEndsAtMs: Number.isFinite(endsAt) ? endsAt : null,
    displayAmount: promoActive ? promo : base,
  };
}

export default function CheckoutCourse() {
  const { t } = useTranslation("courses");
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setError(t("detail.checkout.missingCourseId"));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCourse(courseId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError(t("detail.checkout.missingCourseFallback"));
          return;
        }
        setCourse(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : t("detail.checkout.loadCourseFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, t]);

  const pricing = useMemo(() => {
    if (!course) return null;
    return computeDisplayPrice(course);
  }, [course]);

  const isFreeCourse = !!course && course.access_model !== "paid_upfront";

  const canPay =
    !!course &&
    course.access_model === "paid_upfront" &&
    !!pricing &&
    pricing.displayAmount > 0;

  const handleFreeEnroll = async () => {
    if (!courseId || !course || !isFreeCourse) return;
    if (!user) {
      toast.error(t("detail.checkout.mustLoginToPay"));
      navigate("/login", { replace: true });
      return;
    }
    setSubmitting(true);
    try {
      await enrollCourse(courseId, user);
      toast.success(t("detail.checkout.freeCourseEnrolled"));
      navigate(`/learn/${courseId}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("detail.checkout.createPaymentFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (!courseId || !course || !pricing) return;
    if (!profile?.id) {
      toast.error(t("detail.checkout.mustLoginToPay"));
      navigate("/login", { replace: true });
      return;
    }
    if (!canPay) {
      toast.error(t("detail.checkout.invalidPaymentConfig"));
      return;
    }
    setSubmitting(true);
    try {
      const base = window.location.origin;
      const successUrl = `${base}/checkout/success/course_purchase/${courseId}`;
      const errorUrl = `${base}/courses/${courseId}?payment=error`;
      const cancelUrl = `${base}/courses/${courseId}?payment=cancel`;

      const checkout = await createSePayCheckout({
        courseId,
        purpose: "course_purchase",
        // Backend sẽ tự tính (promo/discount). Chỉ cần >0 để qua validate.
        amountVnd: pricing.displayAmount,
        successUrl,
        errorUrl,
        cancelUrl,
        discountCode: discountCode.trim() || undefined,
      });
      window.sessionStorage.setItem(
        "corelia:lastCheckout",
        JSON.stringify({
          orderId: checkout.order_id,
          courseId,
          purpose: "course_purchase",
          createdAt: Date.now(),
        }),
      );
      completeSePayCheckout(checkout);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("detail.checkout.createPaymentFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-8">
        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="size-10 animate-spin text-foreground-subtle" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("detail.checkout.loadingPaymentInfo")}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="h-4 w-3/4 rounded-full" />
              <Skeleton className="h-4 w-2/3 rounded-full" />
            </div>
            <div className="space-y-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-4 w-2/3 rounded-full" />
              <Skeleton className="h-4 w-1/2 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !course || !courseId) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-8">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {error || t("detail.checkout.missingCourseFallback")}
        </div>
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center gap-2 text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> {t("detail.checkout.backToCourses")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-8">
      <div className="mb-6">
        <Link
          to={`/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> {t("detail.checkout.backToCourse")}
        </Link>
        <h1 className="mt-3 text-2xl font-normal tracking-tight text-foreground">
          {t("detail.checkout.title")}
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("detail.checkout.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
          <h2 className="text-sm font-medium text-foreground">{t("detail.checkout.courseSectionTitle")}</h2>
          <p className="mt-2 text-base text-foreground">{course.title}</p>
          <p className="mt-1 text-sm text-foreground-muted">
            {t("detail.checkout.paymentMethodLabel")}: {t(`accessModel.${course.access_model ?? "free"}`)}
          </p>

          <div className="mt-4 rounded-md border border-border-subtle bg-surface-raised p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-foreground-muted">
                  {t("detail.checkout.paymentAmountLabel")}
                </p>
                {isFreeCourse ? (
                  <div className="mt-1 text-xl font-semibold text-foreground">
                    {formatVndPrice(0)}
                  </div>
                ) : pricing?.promoActive ? (
                  <>
                    <div className="mt-1 text-xl font-semibold text-foreground">
                      {formatVndPrice(pricing.displayAmount)}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      <span className="line-through">
                        {formatVndPrice(pricing.base)}
                      </span>
                      {pricing.promoEndsAtMs ? (
                        <>
                          {" "}
                          ·{" "}
                          {t("detail.checkout.promoEndsPrefix", {
                            date: new Date(pricing.promoEndsAtMs).toLocaleString(intlLocale()),
                          })}
                        </>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-xl font-semibold text-foreground">
                    {formatVndPrice(pricing?.displayAmount ?? course.price_vnd)}
                  </div>
                )}
              </div>
              {!isFreeCourse ? (
                <div className="flex items-center gap-2 text-xs text-foreground-muted">
                  <ShieldCheck className="size-4" aria-hidden /> {t("detail.checkout.sepayQr")}
                </div>
              ) : null}
            </div>

            {!isFreeCourse ? (
              <div className="mt-4">
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  {t("detail.checkout.discount.label")}
                </label>
                <Input
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder={t("detail.checkout.discount.placeholder")}
                />
                <p className="mt-1 text-xs text-foreground-muted">
                  {t("detail.checkout.discount.hint")}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
          <h2 className="text-sm font-medium text-foreground">{t("detail.checkout.paymentAsideTitle")}</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {isFreeCourse ? (
              t("detail.checkout.freeCourseAsideBody")
            ) : (
              <>
                {t("detail.checkout.paymentAsideBodyPrefix")}{" "}
                <span className="font-medium text-foreground">
                  {t("detail.checkout.paymentAsideBodyEmphasis")}
                </span>
                . {t("detail.checkout.paymentAsideBodySuffix")}
              </>
            )}
          </p>

          {isFreeCourse ? (
            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={submitting || !user}
              onClick={() => void handleFreeEnroll()}
            >
              {submitting ? t("detail.checkout.redirecting") : t("detail.checkout.freeCourseEnroll")}
            </Button>
          ) : !canPay ? (
            <div className="mt-4 space-y-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center">
              <p className="text-sm font-medium text-destructive">
                {t("detail.checkout.invalidPaymentConfig")}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/courses/${courseId}`)}
              >
                {t("detail.checkout.backToCourse")}
              </Button>
            </div>
          ) : (
            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={submitting || !canPay || !user}
              onClick={() => void handleContinue()}
            >
              {submitting ? t("detail.checkout.redirecting") : t("detail.checkout.continueToSePay")}
            </Button>
          )}

          {!user ? (
            <p className="mt-3 text-xs text-destructive">
              {t("detail.checkout.mustLoginInline")}
            </p>
          ) : null}

          {!isFreeCourse && canPay ? (
            <p className="mt-3 text-xs text-foreground-muted">
              {t("detail.checkout.postPayHint")}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
