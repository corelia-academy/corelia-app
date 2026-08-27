import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/stores/authStore";
import { getMyPaymentTransactions, type PaymentTransaction } from "@/lib/payments";
import { formatVndPrice } from "@/types/courses";
import { intlLocale } from "@/lib/intl";
import { billingMetadataTranslation, billingPurposeTranslationKey } from "./billingPurpose";

function BillingMetadata({
  transaction,
  className,
}: {
  transaction: PaymentTransaction;
  className: string;
}) {
  const { t } = useTranslation("account");
  const metadata = billingMetadataTranslation(transaction);
  if (metadata.key === "billing.meta.historicalAiProviderOrder") {
    return <div className={className}>{t(metadata.key, metadata.values)}</div>;
  }
  return <div className={className}>{t(metadata.key, metadata.values)}</div>;
}

export function BillingSection() {
  const { t } = useTranslation("account");
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyPaymentTransactions()
      .then((rows) => {
        if (!cancelled) setTransactions(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : t("billing.errors.fetchFailed"),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [user, t]);

  const transactionRows = transactions ?? [];

  return (
    <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <div>
        <h2 className="text-lg font-semibold">{t("billing.title")}</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("billing.subtitle")}
        </p>
      </div>

      {!user ? (
        <div className="rounded-md border border-border-subtle bg-surface-raised p-3 text-sm text-foreground-muted">
          {t("billing.mustLogin")}
        </div>
      ) : transactions === null && !error ? (
        <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-3 text-sm text-foreground-muted">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />{" "}
          {t("billing.loading")}
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : transactionRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
            <CreditCard className="size-6 text-foreground-subtle" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t("billing.empty")}</p>
            <p className="mt-0.5 text-xs text-foreground-muted">{t("billing.subtitle")}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <div className="divide-y divide-border md:hidden">
            {transactionRows.map((tx) => (
              <div key={tx.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {t(billingPurposeTranslationKey(tx.purpose))}
                    </div>
                    <div className="mt-1 text-xs text-foreground-muted">
                      {new Date(tx.created_at).toLocaleString(intlLocale())}
                    </div>
                  </div>
                  <span className="rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-xs text-foreground-muted">
                    {tx.status}
                  </span>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {formatVndPrice(tx.amount_vnd)}
                </div>
                <BillingMetadata
                  transaction={tx}
                  className="text-xs leading-5 text-foreground-muted"
                />
              </div>
            ))}
          </div>

          <table className="hidden w-full text-left text-sm md:table">
            <thead>
              <tr className="bg-surface-raised">
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  {t("billing.table.time")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  {t("billing.table.content")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  {t("billing.table.amount")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  {t("billing.table.status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactionRows.map((tx) => (
                <tr
                  key={tx.id}
                  className="transition-colors duration-150 hover:bg-surface-raised"
                >
                  <td className="px-4 py-3 text-foreground-muted">
                    {new Date(tx.created_at).toLocaleString(intlLocale())}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {t(billingPurposeTranslationKey(tx.purpose))}
                    </div>
                    <BillingMetadata transaction={tx} className="text-xs text-foreground-muted" />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatVndPrice(tx.amount_vnd)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-foreground-muted">
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AccountBillingRoute() {
  return <BillingSection />;
}

