import { useMemo, useState } from "react";
import { useAuth } from "@/stores/authStore";
import { intlLocale } from "@/lib/intl";
import { Input } from "@/components/ui/input";
import type { PartnerProfileDocument } from "@/types/database";
import {
  Bank,
  CalendarDots,
  CreditCard,
  FileText,
  Receipt,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

function ExternalOnlyHint() {
  const { t } = useTranslation("instructor");
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="rounded-2xl border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-5">
        {t("finance.externalOnlyHint")}
      </div>
    </div>
  );
}

function DocumentPanel({
  title,
  description,
  countLabel,
  icon,
  children,
}: {
  title: string;
  description: string;
  countLabel: string;
  icon: React.ComponentType<{ className?: string; weight?: "duotone" }>;
  children: React.ReactNode;
}) {
  const Icon = icon;

  return (
    <section className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">{title}</h2>
          <p className="mt-1.5 text-[14px] text-muted-foreground sm:text-[15px]">
            {description}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
          <Icon className="size-4 text-primary" weight="duotone" />
          {countLabel}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DocumentList({
  emptyLabel,
  rows,
  renderMeta,
}: {
  emptyLabel: string;
  rows: PartnerProfileDocument[];
  renderMeta?: (row: (typeof rows)[number]) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-muted/20 p-4 text-sm text-muted-foreground sm:p-5">
            {emptyLabel}
          </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((doc) => (
        <article
          key={doc.path}
          className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[15px] font-medium text-primary hover:underline"
              title={doc.name}
            >
              {doc.name}
            </a>
            {renderMeta ? (
              <div className="mt-1 text-[13px] text-muted-foreground">
                {renderMeta(doc)}
              </div>
            ) : null}
          </div>
          <div className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <CalendarDots className="size-4" weight="duotone" />
            {new Date(doc.uploaded_at).toLocaleDateString(intlLocale())}
          </div>
        </article>
      ))}
    </div>
  );
}

export function PartnerContractsPage() {
  const { t } = useTranslation("instructor");
  const { profile } = useAuth();
  const rows = profile?.partner_contract_docs ?? [];

  if (profile?.instructor_origin !== "external") return <ExternalOnlyHint />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("partnerFinance.contracts.stats.totalDocuments")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {rows.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("partnerFinance.contracts.stats.source")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {t("partnerFinance.contracts.stats.sourceValue")}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("partnerFinance.contracts.stats.status")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {t("partnerFinance.contracts.stats.statusValue")}
          </p>
        </div>
      </div>

      <DocumentPanel
        title={t("partnerFinance.contracts.panel.title")}
        description={t("partnerFinance.contracts.panel.description")}
        countLabel={t("partnerFinance.contracts.panel.countLabel", { count: rows.length })}
        icon={FileText}
      >
        <DocumentList
          rows={rows}
          emptyLabel={t("partnerFinance.contracts.list.empty")}
          renderMeta={() => t("partnerFinance.contracts.list.meta")}
        />
      </DocumentPanel>
      </div>
    </div>
  );
}

export function PartnerInvoicesPage() {
  const { t } = useTranslation("instructor");
  const { profile } = useAuth();
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const rows = useMemo(() => {
    return (profile?.partner_invoice_docs ?? []).filter((doc) => {
      const explicitMonth = (doc.invoice_month ?? "").trim();
      if (explicitMonth) return explicitMonth === monthFilter;
      const d = new Date(doc.uploaded_at);
      if (Number.isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthFilter;
    });
  }, [profile?.partner_invoice_docs, monthFilter]);

  if (profile?.instructor_origin !== "external") return <ExternalOnlyHint />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("partnerFinance.invoices.stats.currentMonth")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {monthFilter}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("partnerFinance.invoices.stats.total")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {rows.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("partnerFinance.invoices.stats.status")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {t("partnerFinance.invoices.stats.statusValue")}
          </p>
        </div>
      </div>

      <DocumentPanel
        title={t("partnerFinance.invoices.panel.title")}
        description={t("partnerFinance.invoices.panel.description")}
        countLabel={t("partnerFinance.invoices.panel.countLabel", { count: rows.length })}
        icon={Receipt}
      >
        <div className="mb-5 w-full max-w-xs">
          <Input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          />
        </div>
        <DocumentList
          rows={rows}
          emptyLabel={t("partnerFinance.invoices.list.empty")}
          renderMeta={(doc) => (
            <>
              {(doc.invoice_month ?? "").trim()
                ? t("partnerFinance.invoices.list.invoiceMonthPrefix", {
                    month: doc.invoice_month,
                  })
                : t("partnerFinance.invoices.list.noInvoiceMonth")}
              {doc.note ? ` · ${doc.note}` : ""}
            </>
          )}
        />
      </DocumentPanel>
      </div>
    </div>
  );
}

export function PartnerPaymentsPage() {
  const { t } = useTranslation("instructor");
  const { profile } = useAuth();
  const transferInfo = (profile?.partner_transfer_info ?? "").trim();
  const bankName = (profile?.partner_bank_name ?? "").trim();
  const bankAccount = (profile?.partner_bank_account_number ?? "").trim();
  const bankHolder = (profile?.partner_bank_account_holder ?? "").trim();
  const bankNote = (profile?.partner_bank_transfer_note ?? "").trim();

  if (profile?.instructor_origin !== "external") return <ExternalOnlyHint />;

  const hasBankInfo = Boolean(bankName || bankAccount || bankHolder || bankNote);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("partnerFinance.payments.stats.bankAccount")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {bankAccount || t("partnerFinance.common.notAvailable")}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("partnerFinance.payments.stats.accountHolder")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {bankHolder || t("partnerFinance.common.notAvailable")}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("partnerFinance.payments.stats.payoutGuide")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {transferInfo
              ? t("partnerFinance.common.updated")
              : t("partnerFinance.common.notAvailable")}
          </p>
        </div>
      </div>

      <DocumentPanel
        title={t("partnerFinance.payments.panel.title")}
        description={t("partnerFinance.payments.panel.description")}
        countLabel={
          hasBankInfo
            ? t("partnerFinance.payments.panel.ready")
            : t("partnerFinance.payments.panel.missingInfo")
        }
        icon={CreditCard}
      >
        {hasBankInfo ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-foreground">
                <Bank className="size-4 text-primary" weight="duotone" />
                {t("partnerFinance.payments.sections.transferInfo")}
              </div>
              <div className="grid gap-2 text-sm">
                {bankName ? (
                  <div>
                    <span className="text-muted-foreground">
                      {t("partnerFinance.payments.fields.bankName")}
                    </span>{" "}
                    <span className="font-medium text-foreground">{bankName}</span>
                  </div>
                ) : null}
                {bankAccount ? (
                  <div>
                    <span className="text-muted-foreground">
                      {t("partnerFinance.payments.fields.accountNumber")}
                    </span>{" "}
                    <span className="font-medium text-foreground">{bankAccount}</span>
                  </div>
                ) : null}
                {bankHolder ? (
                  <div>
                    <span className="text-muted-foreground">
                      {t("partnerFinance.payments.fields.accountHolder")}
                    </span>{" "}
                    <span className="font-medium text-foreground">{bankHolder}</span>
                  </div>
                ) : null}
                {bankNote ? (
                  <div>
                    <span className="text-muted-foreground">
                      {t("partnerFinance.payments.fields.transferNote")}
                    </span>{" "}
                    <span className="text-foreground">{bankNote}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-foreground">
                <CreditCard className="size-4 text-primary" weight="duotone" />
                {t("partnerFinance.payments.sections.extraNotes")}
              </div>
              {transferInfo ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {transferInfo}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("partnerFinance.payments.emptyExtraNotes")}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-muted/20 p-5 text-sm text-muted-foreground">
            {t("partnerFinance.payments.empty")}
          </div>
        )}
      </DocumentPanel>
      </div>
    </div>
  );
}
