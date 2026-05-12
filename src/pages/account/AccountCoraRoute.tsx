import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import {
  Bot,
  Check,
  CreditCard,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { intlLocale } from "@/lib/intl";
import {
  createAiSubscriptionCheckout,
  getMyPaymentTransactions,
  submitSePayCheckoutForm,
  type AiSubscriptionDurationMonths,
  type AiSubscriptionTier,
  type PaymentTransaction,
} from "@/lib/payments";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import { formatVndPrice } from "@/types/courses";

const TIER_ORDER: AiSubscriptionTier[] = ["student", "pro", "bootcamp"];
const DURATION_ORDER: AiSubscriptionDurationMonths[] = [1, 6, 12];

const TIER_PRICES: Record<
  AiSubscriptionTier,
  Record<AiSubscriptionDurationMonths, number>
> = {
  student: {
    1: 99_000,
    6: 499_000,
    12: 890_000,
  },
  pro: {
    1: 299_000,
    6: 1_490_000,
    12: 2_690_000,
  },
  bootcamp: {
    1: 1_990_000,
    6: 9_990_000,
    12: 17_900_000,
  },
};

function buildCheckoutUrl(status: "success" | "error" | "cancel") {
  return `${window.location.origin}/account/cora?payment=${status}`;
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
  const { user, aiSubscription, daysUntilExpiry, loadAiSubscription } = useAuth();
  const [selectedTierOverride, setSelectedTierOverride] =
    useState<AiSubscriptionTier | null>(null);
  const [selectedDuration, setSelectedDuration] =
    useState<AiSubscriptionDurationMonths>(1);
  const [transactions, setTransactions] = useState<PaymentTransaction[] | null>(
    null,
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTier = selectedTierOverride ?? aiSubscription?.tier ?? "student";
  const loadingTransactions = user ? transactions === null && !error : false;

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    loadAiSubscription();
    getMyPaymentTransactions()
      .then((rows) => {
        if (cancelled) return;
        const aiRows = rows.filter((row) => row.purpose === "ai_subscription");
        setTransactions(aiRows);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : t("cora.errors.fetchTransactions"),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [loadAiSubscription, t, user]);

  const selectedPrice = TIER_PRICES[selectedTier][selectedDuration];
  const aiTransactions = useMemo(() => transactions ?? [], [transactions]);
  const activePlanLabel = aiSubscription
    ? t(`cora.tiers.${aiSubscription.tier}.title`)
    : t("cora.currentPlan.free");

  async function handleCheckout() {
    if (!user) {
      setError(t("cora.mustLogin"));
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
      });
      submitSePayCheckoutForm(checkout);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cora.errors.checkoutFailed"));
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_left,_rgba(var(--primary-rgb),0.18),_transparent_55%),linear-gradient(135deg,rgba(var(--primary-rgb),0.08),transparent_45%)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Bot className="size-3.5" aria-hidden />
              Cora AI
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-foreground">
              {t("cora.title")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">
              {t("cora.subtitle")}
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-background/80 p-4 shadow-sm lg:w-80">
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
            <div className="mt-4 grid gap-2 text-sm text-foreground-muted">
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
          </div>
        </div>
      </section>

      {!user ? (
        <section className="rounded-lg border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted">
          {t("cora.mustLogin")}
        </section>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("cora.selector.title")}
                </h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  {t("cora.selector.subtitle")}
                </p>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {TIER_ORDER.map((tier) => {
                  const isActive = selectedTier === tier;
                  const tierPrice = TIER_PRICES[tier][selectedDuration];
                  const features = t(`cora.tiers.${tier}.features`, {
                    returnObjects: true,
                  }) as string[];

                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTierOverride(tier)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-colors duration-150",
                        isActive
                          ? "border-primary bg-primary-muted/60"
                          : "border-border-subtle bg-surface-raised hover:border-primary/30",
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

                      <div className="mt-4">
                        <div className="text-xl font-semibold text-foreground">
                          {formatVndPrice(tierPrice)}
                        </div>
                        <div className="text-xs text-foreground-muted">
                          {t("cora.selector.perDuration", {
                            duration: t(`cora.duration.${selectedDuration}.label`),
                          })}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
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
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
              <h2 className="text-lg font-semibold text-foreground">
                {t("cora.durationTitle")}
              </h2>
              <div className="mt-4 grid gap-3">
                {DURATION_ORDER.map((duration) => {
                  const isActive = selectedDuration === duration;
                  return (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => setSelectedDuration(duration)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left transition-colors duration-150",
                        isActive
                          ? "border-primary bg-primary-muted/60"
                          : "border-border-subtle bg-surface-raised hover:border-primary/30",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">
                            {t(`cora.duration.${duration}.label`)}
                          </div>
                          <div className="mt-1 text-xs text-foreground-muted">
                            {t(`cora.duration.${duration}.note`)}
                          </div>
                        </div>
                        {isActive ? (
                          <span className="rounded-full bg-primary/15 p-1 text-primary">
                            <Check className="size-4" aria-hidden />
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-border-subtle bg-surface-raised p-4">
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
                      {formatVndPrice(selectedPrice)}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {t("cora.selector.perDuration", {
                        duration: t(`cora.duration.${selectedDuration}.label`),
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-4 w-full"
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
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
            <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </section>
          ) : null}

          <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
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
              <div className="mt-4 flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-3 text-sm text-foreground-muted">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                {t("cora.history.loading")}
              </div>
            ) : aiTransactions.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-border-subtle bg-surface-raised p-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("cora.history.empty")}
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-md border border-border">
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
                            {formatVndPrice(tx.amount_vnd)}
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
  );
}

export default AccountCoraRoute;
