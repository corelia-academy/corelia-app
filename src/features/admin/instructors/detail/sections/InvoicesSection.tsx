import { Input } from "@/components/ui/input";
import { InstructorDocumentList } from "@/features/admin/instructors/components/InstructorDocumentList";
import type { PartnerProfileDocument } from "@/types/database";
import type { TFunction } from "i18next";

export function InvoicesSection({
  t,
  isExternal,
  uploading,
  invoiceDocs,
  invoiceMonthDraft,
  setInvoiceMonthDraft,
  invoiceNoteDraft,
  setInvoiceNoteDraft,
  onUpload,
}: {
  t: TFunction<"admin">;
  isExternal: boolean;
  uploading: boolean;
  invoiceDocs: PartnerProfileDocument[];
  invoiceMonthDraft: string;
  setInvoiceMonthDraft: (value: string) => void;
  invoiceNoteDraft: string;
  setInvoiceNoteDraft: (value: string) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
      {!isExternal ? (
        <p className="text-sm text-muted-foreground">
          {t("instructorDetailPage.invoices.externalOnly")}
        </p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-foreground">
                {t("instructorDetailPage.invoices.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("instructorDetailPage.invoices.description")}
              </p>
            </div>
            <span className="rounded-full border border-border-subtle bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {t("instructorDetailPage.invoices.countLabel", {
                count: invoiceDocs.length,
              })}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                {t("instructorDetailPage.invoices.invoiceMonthLabel")}
              </label>
              <Input
                type="month"
                value={invoiceMonthDraft}
                onChange={(e) => setInvoiceMonthDraft(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm font-medium">
                {t("instructorDetailPage.invoices.noteLabel")}
              </label>
              <Input
                value={invoiceNoteDraft}
                onChange={(e) => setInvoiceNoteDraft(e.target.value)}
                placeholder={t("instructorDetailPage.invoices.notePlaceholder")}
              />
            </div>
            <div className="grid gap-2 sm:col-span-3">
              <label className="text-sm font-medium">
                {t("instructorDetailPage.invoices.uploadLabel")}
              </label>
              <input
                type="file"
                className="block w-full text-xs"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="mt-5">
            <InstructorDocumentList
              docs={invoiceDocs}
              emptyLabel={t("instructorDetailPage.invoices.empty")}
              renderMeta={(doc) => (
                <>
                  {doc.invoice_month
                    ? t("instructorDetailPage.invoices.invoiceMonthPrefix", {
                        month: doc.invoice_month,
                      })
                    : t("instructorDetailPage.common.dash")}
                  {doc.note ? ` · ${doc.note}` : ""}
                </>
              )}
            />
          </div>
        </>
      )}
    </section>
  );
}

