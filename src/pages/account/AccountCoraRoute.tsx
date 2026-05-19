import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import {
  Bot,
  Check,
  CreditCard,
  Loader2,
  Sparkles,
  TicketPercent,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { intlLocale } from "@/lib/intl";
import {
  createAiSubscriptionCheckout,
  getMyPaymentTransactions,
  previewAiVoucher,
  submitSePayCheckoutForm,
  type AiVoucherPreview,
  type AiSubscriptionDurationMonths,
  type AiSubscriptionTier,
  type PaymentTransaction,
  verifySePayPayment,
} from "@/lib/payments";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import { useCoraStore } from "@/stores/coraStore";
import { formatVndPrice } from "@/types/courses";

const TIER_ORDER: AiSubscriptionTier[] = ["student", "pro", "bootcamp"];
const TIER_RANK: Record<AiSubscriptionTier, number> = { student: 1, pro: 2, bootcamp: 3 };
const DURATION_ORDER: AiSubscriptionDurationMonths[] = [1, 12];
const AI_SUBSCRIPTION_PRODUCT_ID = "cora-ai";

type StoredCheckout = {
  orderId?: string;
  courseId?: string;
  purpose?: string;
  createdAt?: number;
};

const TIER_PRICES: Record<
  AiSubscriptionTier,
  Record<AiSubscriptionDurationMonths, number>
> = {
  student: {
    1: 79_000,
    12: 690_000,
  },
  pro: {
    1: 149_000,
    12: 1_290_000,
  },
  bootcamp: {
    1: 399_000,
    12: 3_490_000,
  },
};

function getDurationValue(duration: AiSubscriptionDurationMonths) {
  return Number(duration);
}

function buildCheckoutUrl(status: "success" | "error" | "cancel") {
  return `${window.location.origin}/cora?payment=${status}`;
}

function statusTone(status: PaymentTransaction["status"]) {
  switch (status) {
    case "paid":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "failed":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    case "cancelled":
      return "border-border-subtle bg-surface-raised text-foreground-muted";
    default:
      return "border-warning/20 bg-warning/10 text-warning";
  }
}

export function AccountCoraRoute() {
  const { t } = useTranslation("account");
  const location = useLocation();
  const { user, aiSubscription, daysUntilExpiry, loadAiSubscription } = useAuth();
  const coraQuotaInfo = useCoraStore((s) => s.quotaInfo);
  const setCoraQuotaInfo = useCoraStore((s) => s.setQuotaInfo);
  const [selectedTierOverride, setSelectedTierOverride] =
    useState<AiSubscriptionTier | null>(null);
  const [selectedDuration, setSelectedDuration] =
    useState<AiSubscriptionDurationMonths>(12);
  const [transactions, setTransactions] = useState<PaymentTransaction[] | null>(
    null,
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherPreview, setVoucherPreview] = useState<AiVoucherPreview | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentVerificationState, setPaymentVerificationState] = useState<
    "idle" | "verifying" | "verified" | "timeout" | "failed"
  >("idle");
  const selectedTier = selectedTierOverride ?? aiSubscription?.tier ?? "student";
  const hasActiveSubscription = !!aiSubscription && daysUntilExpiry != null && daysUntilExpiry >= 0;
  const currentTierRank = aiSubscription ? (TIER_RANK[aiSubscription.tier] ?? 0) : 0;
  const isUpgrade = hasActiveSubscription && (TIER_RANK[selectedTier] ?? 0) > currentTierRank;
  const tierChangeBlocked = hasActiveSubscription && (TIER_RANK[selectedTier] ?? 0) < currentTierRank;
  const loadingTransactions = user ? transactions === null && !error : false;
  const paymentState = new URLSearchParams(location.search).get("payment");
  const paymentNotice =
    paymentState === "success" && paymentVerificationState === "verified"
      ? {
          tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          title: t("cora.return.verifiedTitle"),
          description: t("cora.return.verifiedDescription"),
        }
      : paymentState === "success" && paymentVerificationState === "timeout"
        ? {
            tone: "border-warning/30 bg-warning/10 text-warning",
            title: t("cora.return.timeoutTitle"),
            description: t("cora.return.timeoutDescription"),
          }
        : paymentState === "success" && paymentVerificationState === "failed"
          ? {
              tone: "border-destructive/30 bg-destructive/10 text-destructive",
              title: t("cora.return.errorTitle"),
              description: t("cora.return.errorDescription"),
            }
          : paymentState === "success"
            ? {
                tone: "border-primary/30 bg-primary/10 text-primary",
                title: t("cora.return.verifyingTitle"),
                description: t("cora.return.verifyingDescription"),
              }
            : paymentState === "error"
        ? {
            tone: "border-destructive/30 bg-destructive/10 text-destructive",
            title: t("cora.return.errorTitle"),
            description: t("cora.return.errorDescription"),
          }
        : paymentState === "cancel"
          ? {
              tone: "border-warning/30 bg-warning/10 text-warning",
              title: t("cora.return.cancelTitle"),
              description: t("cora.return.cancelDescription"),
            }
          : null;

  const loadAiTransactions = useCallback(async () => {
    const rows = await getMyPaymentTransactions();
    const aiRows = rows.filter((row) => row.purpose === "ai_subscription");
    setTransactions(aiRows);
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    void (async () => {
      try {
        await loadAiSubscription();
        if (cancelled) return;
        await loadAiTransactions();
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : t("cora.errors.fetchTransactions"),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadAiSubscription, loadAiTransactions, paymentState, t, user]);

  useEffect(() => {
    if (!user || paymentState !== "success") return;

    let cancelled = false;
    let stored: StoredCheckout | null = null;
    try {
      const raw = window.sessionStorage.getItem("corelia:lastCheckout");
      stored = raw ? (JSON.parse(raw) as StoredCheckout) : null;
    } catch {
      stored = null;
    }

    const orderId =
      stored?.courseId === AI_SUBSCRIPTION_PRODUCT_ID &&
      stored?.purpose === "ai_subscription"
        ? stored.orderId
        : undefined;

    void (async () => {
      setPaymentVerificationState("verifying");
      const deadline = Date.now() + 30_000;
      while (!cancelled && Date.now() < deadline) {
        try {
          const result = await verifySePayPayment({
            orderId,
            courseId: AI_SUBSCRIPTION_PRODUCT_ID,
            purpose: "ai_subscription",
          });
          if (cancelled) return;

          if (result.status === "paid") {
            setPaymentVerificationState("verified");
            window.sessionStorage.removeItem("corelia:lastCheckout");
            setCoraQuotaInfo(null);
            await Promise.all([loadAiSubscription(), loadAiTransactions()]);
            return;
          }

          if (result.status === "failed" || result.status === "cancelled") {
            setPaymentVerificationState("failed");
            return;
          }
        } catch {
          // Keep polling for a short window to absorb gateway/webhook delay.
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      }

      if (!cancelled) setPaymentVerificationState("timeout");
    })();

    return () => {
      cancelled = true;
    };
  }, [loadAiSubscription, loadAiTransactions, paymentState, setCoraQuotaInfo, user]);

  const selectedPrice = TIER_PRICES[selectedTier][selectedDuration];
  const selectedBaseMonthlyPrice = TIER_PRICES[selectedTier][1];
  const selectedFullPrice = selectedBaseMonthlyPrice * getDurationValue(selectedDuration);
  const selectedSavings = Math.max(selectedFullPrice - selectedPrice, 0);
  const selectedSavingsPercent =
    selectedFullPrice > 0
      ? Math.round((selectedSavings / selectedFullPrice) * 100)
      : 0;
  const selectedMonthlyEquivalent = Math.round(
    selectedPrice / getDurationValue(selectedDuration),
  );
  const effectivePrice = voucherPreview?.final_amount_vnd ?? selectedPrice;
  const aiTransactions = useMemo(() => transactions ?? [], [transactions]);
  const activePlanLabel = aiSubscription
    ? t(`cora.tiers.${aiSubscription.tier}.title`)
    : t("cora.currentPlan.free");

  useEffect(() => {
    setVoucherPreview(null);
    setError(null);
  }, [selectedTier, selectedDuration]);

  async function handleApplyVoucher() {
    if (!voucherCode.trim()) {
      setError(t("cora.errors.voucherMissing"));
      return;
    }
    try {
      setVoucherLoading(true);
      setError(null);
      const preview = await previewAiVoucher({
        tier: selectedTier,
        durationMonths: selectedDuration,
        voucherCode: voucherCode.trim(),
      });
      setVoucherPreview(preview);
    } catch (err) {
      setVoucherPreview(null);
      setError(err instanceof Error ? err.message : t("cora.errors.voucherFailed"));
    } finally {
      setVoucherLoading(false);
    }
  }

  async function handleCheckout() {
    if (!user) {
      setError(t("cora.mustLogin"));
      return;
    }
    if (tierChangeBlocked) {
      setError(t("cora.errors.tierChangeBlocked"));
      return;
    }

    try {
      setCheckoutLoading(true);
      setError(null);
      const checkout = await createAiSubscriptionCheckout({
        tier: selectedTier,
        durationMonths: selectedDuration,
        successUrl: buildCheckoutUrl("success"),
        errorUrl: buildCheckoutUrl("error"),
        cancelUrl: buildCheckoutUrl("cancel"),
        voucherCode: voucherPreview?.code,
      });
      window.sessionStorage.setItem(
        "corelia:lastCheckout",
        JSON.stringify({
          orderId: checkout.order_id,
          courseId: AI_SUBSCRIPTION_PRODUCT_ID,
          purpose: "ai_subscription",
          createdAt: Date.now(),
        } satisfies StoredCheckout),
      );
      submitSePayCheckoutForm(checkout);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cora.errors.checkoutFailed"));
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="container-app py-6 sm:py-8 lg:py-10">
      <div className="space-y-6 sm:space-y-7 lg:space-y-8">
        <section className="rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_left,_rgba(var(--primary-rgb),0.18),_transparent_55%),linear-gradient(135deg,rgba(var(--primary-rgb),0.08),transparent_45%)] px-5 py-6 sm:px-6 sm:py-7 lg:px-7 lg:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Bot className="size-3.5" aria-hidden />
              Cora AI
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">
              {t("cora.title")}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-foreground-muted sm:text-[15px]">
              {t("cora.subtitle")}
            </p>
          </div>

            <div className="self-start rounded-xl border border-border-subtle bg-background/80 p-5 shadow-sm lg:w-80 lg:p-6">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
                    {t("cora.currentPlan.statusLabel")}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">
                    {activePlanLabel}
                  </h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {aiSubscription
                      ? t("cora.currentPlan.active")
                      : t("cora.currentPlan.notSubscribed")}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm text-foreground-muted">
                <div className="flex items-center justify-between gap-3">
                  <span>{t("cora.currentPlan.expiryLabel")}</span>
                  <span className="font-medium text-foreground">
                    {aiSubscription
                      ? new Date(aiSubscription.expires_at).toLocaleDateString(
                          intlLocale(),
                        )
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t("cora.currentPlan.daysLeftLabel")}</span>
                  <span className="font-medium text-foreground">
                    {typeof daysUntilExpiry === "number"
                      ? t("cora.currentPlan.daysLeft", {
                          count: Math.max(daysUntilExpiry, 0),
                        })
                      : "—"}
                  </span>
                </div>
              </div>
              {coraQuotaInfo ? (
                <div className="mt-4 border-t border-border-subtle pt-4 text-sm">
                  {(() => {
                    const limit = coraQuotaInfo.monthlyLimit;
                    const used = coraQuotaInfo.monthlyUsed;
                    const usedPct = limit ? used / limit : 0;
                    const isExceeded = usedPct >= 1;
                    const isNearing = usedPct >= 0.7 && !isExceeded;
                    const resetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
                    const resetStr = resetDate.toLocaleDateString(intlLocale(), { day: "2-digit", month: "2-digit", year: "numeric" });
                    const nextTier = aiSubscription?.tier === "student" ? "pro" : aiSubscription?.tier === "pro" ? "bootcamp" : null;

                    if (isExceeded) {
                      return (
                        <div className="space-y-3">
                          <p className="font-medium text-foreground">{t("cora.currentPlan.quotaExceededMsg")}</p>
                          <p className="text-foreground-muted">{t("cora.currentPlan.quotaResetDate", { date: resetStr })}</p>
                          {nextTier ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {(["pro", "bootcamp"] as const).filter((tier) => (TIER_RANK[tier] ?? 0) > (currentTierRank ?? 0)).map((tier) => (
                                <Button
                                  key={tier}
                                  render={<NavLink to={`/cora?tier=${tier}`} />}
                                  nativeButton={false}
                                  size="sm"
                                  variant="outline"
                                >
                                  {t(`cora.tiers.${tier}.title`)} · {formatVndPrice(TIER_PRICES[tier][1])}/tháng
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    if (isNearing) {
                      const remaining = limit ? Math.max(limit - used, 0) : null;
                      return (
                        <div className="space-y-2">
                          <p className="font-medium text-foreground">{t("cora.currentPlan.nearingQuota")}</p>
                          <p className="text-foreground-muted">
                            {t("cora.currentPlan.nearingQuotaSub", { remaining, date: resetStr })}
                          </p>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border-subtle">
                            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.min(usedPct * 100, 100)}%` }} />
                          </div>
                          {nextTier ? (
                            <Button render={<NavLink to={`/cora?tier=${nextTier}`} />} nativeButton={false} size="sm" variant="outline" className="mt-1">
                              {t("cora.currentPlan.upgradeNudge", { tier: t(`cora.tiers.${nextTier}.title`) })}
                            </Button>
                          ) : null}
                        </div>
                      );
                    }

                    // Comfortable state
                    return (
                      <div className="space-y-2">
                        <p className="text-foreground-muted">
                          {t("cora.currentPlan.questionsAnswered", { count: used })}
                        </p>
                        {limit ? (
                          <div className="h-1 w-full overflow-hidden rounded-full bg-border-subtle">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(usedPct * 100, 100)}%` }} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        </section>

      {!user ? (
        <section className="rounded-xl border border-border-subtle bg-surface-base px-5 py-4 text-sm text-foreground-muted sm:px-6">
          {t("cora.mustLogin")}
        </section>
      ) : (
        <>
          {paymentNotice ? (
            <section
              className={cn(
                "rounded-xl border px-5 py-4 sm:px-6",
                paymentNotice.tone,
              )}
            >
              <p className="text-sm font-medium">{paymentNotice.title}</p>
              <p className="mt-1 text-sm/6 text-current/90">
                {paymentNotice.description}
              </p>
            </section>
          ) : null}

          <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] xl:gap-6">
            <div className="rounded-xl border border-border-subtle bg-surface-base p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("cora.selector.title")}
                </h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  {t("cora.selector.subtitle")}
                </p>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {TIER_ORDER.map((tier) => {
                  const isActive = selectedTier === tier;
                  const tierPrice = TIER_PRICES[tier][selectedDuration];
                  const disabled = hasActiveSubscription && (TIER_RANK[tier] ?? 0) < currentTierRank;
                  const features = t(`cora.tiers.${tier}.features`, {
                    returnObjects: true,
                  }) as string[];

                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => !disabled && setSelectedTierOverride(tier)}
                      disabled={disabled}
                      className={cn(
                        "flex h-full flex-col rounded-xl border p-5 text-left transition-colors duration-150",
                        isActive
                          ? "border-primary bg-primary-muted/60"
                          : "border-border-subtle bg-surface-raised hover:border-primary/30",
                        disabled && "cursor-not-allowed opacity-55 hover:border-border-subtle",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            {t(`cora.tiers.${tier}.title`)}
                          </h3>
                          <p className="mt-1 text-sm text-foreground-muted">
                            {t(`cora.tiers.${tier}.description`)}
                          </p>
                        </div>
                        {isActive ? (
                          <span className="rounded-full bg-primary/15 p-1 text-primary">
                            <Check className="size-4" aria-hidden />
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5">
                        <div className="text-xl font-semibold text-foreground">
                          {formatVndPrice(tierPrice)}
                        </div>
                        <div className="text-xs text-foreground-muted">
                          {t("cora.selector.perDuration", {
                            duration: t(`cora.duration.${selectedDuration}.label`),
                          })}
                        </div>
                      </div>

                      <div className="mt-5 space-y-2.5">
                        {features.map((feature) => (
                          <div
                            key={feature}
                            className="flex items-start gap-2 text-sm text-foreground-muted"
                          >
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-foreground-subtle">
                {t("cora.tiers.bootcamp.fairUseNote")}
              </p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface-base p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">
                {t("cora.durationTitle")}
              </h2>
              <div className="mt-6 grid gap-3">
                {DURATION_ORDER.map((duration) => {
                  const isActive = selectedDuration === duration;
                  const durationPrice = TIER_PRICES[selectedTier][duration];
                  const baseMonthlyPrice = TIER_PRICES[selectedTier][1];
                  const fullPrice = baseMonthlyPrice * getDurationValue(duration);
                  const savings = Math.max(fullPrice - durationPrice, 0);
                  const savingsPercent =
                    fullPrice > 0
                      ? Math.round((savings / fullPrice) * 100)
                      : 0;
                  const monthlyEquivalent = Math.round(
                    durationPrice / getDurationValue(duration),
                  );
                  return (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => setSelectedDuration(duration)}
                      className={cn(
                        "rounded-xl border px-4 py-3.5 text-left transition-colors duration-150",
                        isActive
                          ? "border-primary bg-primary-muted/60"
                          : "border-border-subtle bg-surface-raised hover:border-primary/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-foreground">
                              {t(`cora.duration.${duration}.label`)}
                            </div>
                            {duration === 12 ? (
                              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                {t("cora.duration.12.popular")}
                              </span>
                            ) : null}
                          {duration === 12 && savings > 0 ? (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                {t("cora.durationSavingsBadge", {
                                  percent: savingsPercent,
                                })}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-foreground-muted">
                            {t(`cora.duration.${duration}.note`)}
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-foreground-muted">
                            <div>
                              {t("cora.durationMonthlyEquivalent", {
                                amount: formatVndPrice(monthlyEquivalent),
                              })}
                            </div>
                            {duration === 12 && savings > 0 ? (
                              <div>
                                {t("cora.durationSavingsDetail", {
                                  amount: formatVndPrice(savings),
                                })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground">
                              {formatVndPrice(durationPrice)}
                            </div>
                          </div>
                          {isActive ? (
                            <span className="rounded-full bg-primary/15 p-1 text-primary">
                              <Check className="size-4" aria-hidden />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {isUpgrade ? (
                <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-foreground-muted">
                  {t("cora.selector.upgradeImmediateWarning", {
                    newTier: t(`cora.tiers.${selectedTier}.title`),
                    currentTier: t(`cora.tiers.${aiSubscription?.tier ?? "student"}.title`),
                    days: Math.max(daysUntilExpiry ?? 0, 0),
                  })}
                </div>
              ) : hasActiveSubscription ? (
                <div className="mt-5 rounded-lg border border-border-subtle bg-surface-raised px-3 py-3 text-sm text-foreground-muted">
                  {t("cora.selector.activeRenewalHint", {
                    tier: t(`cora.tiers.${aiSubscription?.tier ?? "student"}.title`),
                  })}
                </div>
              ) : null}

              <div className="mt-7 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t(`cora.tiers.${selectedTier}.title`)}
                    </p>
                    <p className="mt-1 text-sm text-foreground-muted">
                      {t(`cora.duration.${selectedDuration}.label`)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-foreground">
                      {formatVndPrice(effectivePrice)}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {t("cora.selector.perDuration", {
                        duration: t(`cora.duration.${selectedDuration}.label`),
                      })}
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-border-subtle bg-background/70 px-3 py-3">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <TicketPercent className="size-4 text-primary" aria-hidden />
                      {t("cora.voucher.label")}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={voucherCode}
                        onChange={(event) => setVoucherCode(event.target.value.toUpperCase())}
                        placeholder={t("cora.voucher.placeholder")}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleApplyVoucher()}
                        disabled={voucherLoading}
                      >
                        {voucherLoading ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          t("cora.voucher.apply")
                        )}
                      </Button>
                      {voucherPreview ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setVoucherPreview(null);
                            setVoucherCode("");
                          }}
                        >
                          <X className="size-4" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-foreground-muted">
                      {t("cora.voucher.hint")}
                    </p>
                  </div>
                  {voucherPreview ? (
                    <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">
                          {voucherPreview.code}
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300">
                          -{voucherPreview.percent_off}%
                        </span>
                      </div>
                      <div className="mt-1 text-emerald-700/90 dark:text-emerald-300/90">
                        {t("cora.voucher.applied", {
                          amount: formatVndPrice(voucherPreview.discount_amount_vnd),
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-foreground-muted">
                      {t("cora.durationValueLabel")}
                    </span>
                    <span className="font-medium text-foreground">
                      {t("cora.durationMonthlyEquivalent", {
                        amount: formatVndPrice(selectedMonthlyEquivalent),
                      })}
                    </span>
                  </div>
                  {selectedDuration > 1 && selectedSavings > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-foreground-muted">
                        {t("cora.durationSavingsSummaryLabel")}
                      </span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">
                        {t("cora.durationSavingsSummaryValue", {
                          amount: formatVndPrice(selectedSavings),
                          percent: selectedSavingsPercent,
                        })}
                      </span>
                    </div>
                  ) : null}
                  {voucherPreview ? (
                    <>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-foreground-muted">{t("cora.voucher.basePrice")}</span>
                        <span className="font-medium text-foreground">{formatVndPrice(voucherPreview.base_amount_vnd)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-foreground-muted">{t("cora.voucher.discountValue")}</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">
                          -{formatVndPrice(voucherPreview.discount_amount_vnd)}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
                <Button
                  type="button"
                  className="mt-5 w-full"
                  onClick={handleCheckout}
                  disabled={checkoutLoading || tierChangeBlocked}
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("cora.selector.checkoutLoading")}
                    </>
                  ) : (
                    <>
                      <CreditCard className="size-4" />
                      {t("cora.selector.checkoutAction")}
                    </>
                  )}
                </Button>
                <p className="mt-2 text-xs leading-5 text-foreground-muted">
                  {t("cora.selector.checkoutHint")}
                </p>
              </div>
            </div>
          </section>

          {error ? (
            <section className="rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive sm:px-6">
              {error}
            </section>
          ) : null}

          <section className="rounded-xl border border-border-subtle bg-surface-base p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("cora.history.title")}
                </h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  {t("cora.history.subtitle")}
                </p>
              </div>
              <Button
                render={<NavLink to="/account/billing" />}
                nativeButton={false}
                size="sm"
                variant="outline"
              >
                {t("nav.billing.title")}
              </Button>
            </div>

            {loadingTransactions ? (
              <div className="mt-5 flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-3 text-sm text-foreground-muted">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                {t("cora.history.loading")}
              </div>
            ) : aiTransactions.length === 0 ? (
              <div className="mt-5 rounded-md border border-dashed border-border-subtle bg-surface-raised p-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("cora.history.empty")}
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-md border border-border">
                <div className="divide-y divide-border md:hidden">
                  {aiTransactions.map((tx) => {
                    const planLabel =
                      aiSubscription?.payment_transaction_id === tx.id
                        ? t(`cora.tiers.${aiSubscription.tier}.title`)
                        : t("cora.history.planFallback");
                    return (
                      <div key={tx.id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">
                              {planLabel}
                            </div>
                            <div className="mt-1 text-xs text-foreground-muted">
                              {new Date(tx.created_at).toLocaleString(intlLocale())}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs",
                              statusTone(tx.status),
                            )}
                          >
                            {tx.status}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {formatVndPrice(tx.amount_vnd)}
                        </div>
                        {tx.discount_code ? (
                          <div className="text-xs text-foreground-muted">
                            {tx.discount_code} · -{formatVndPrice(tx.discount_amount_vnd ?? 0)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <table className="hidden w-full text-left text-sm md:table">
                  <thead>
                    <tr className="bg-surface-raised">
                      <th className="px-4 py-3 font-medium text-foreground-muted">
                        {t("cora.history.table.time")}
                      </th>
                      <th className="px-4 py-3 font-medium text-foreground-muted">
                        {t("cora.history.table.plan")}
                      </th>
                      <th className="px-4 py-3 font-medium text-foreground-muted">
                        {t("cora.history.table.amount")}
                      </th>
                      <th className="px-4 py-3 font-medium text-foreground-muted">
                        {t("cora.history.table.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {aiTransactions.map((tx) => {
                      const planLabel =
                        aiSubscription?.payment_transaction_id === tx.id
                          ? t(`cora.tiers.${aiSubscription.tier}.title`)
                          : t("cora.history.planFallback");
                      return (
                        <tr
                          key={tx.id}
                          className="transition-colors duration-150 hover:bg-surface-raised"
                        >
                          <td className="px-4 py-3 text-foreground-muted">
                            {new Date(tx.created_at).toLocaleString(intlLocale())}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {planLabel}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            <div>{formatVndPrice(tx.amount_vnd)}</div>
                            {tx.discount_code ? (
                              <div className="text-xs font-normal text-foreground-muted">
                                {tx.discount_code} · -{formatVndPrice(tx.discount_amount_vnd ?? 0)}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs",
                                statusTone(tx.status),
                              )}
                            >
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      </div>
    </div>
  );
}

export default AccountCoraRoute;
