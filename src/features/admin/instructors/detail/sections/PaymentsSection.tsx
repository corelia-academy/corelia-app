import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TFunction } from "i18next";

export type PartnerBankForm = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  transfer_note: string;
};

export function PaymentsSection({
  t,
  isExternal,
  bankForm,
  setBankForm,
  transferInfo,
  setTransferInfo,
  saving,
  onSave,
}: {
  t: TFunction<"admin">;
  isExternal: boolean;
  bankForm: PartnerBankForm;
  setBankForm: Dispatch<SetStateAction<PartnerBankForm>>;
  transferInfo: string;
  setTransferInfo: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
      {!isExternal ? (
        <p className="text-sm text-muted-foreground">
          {t("instructorDetailPage.payments.externalOnly")}
        </p>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-medium text-foreground">
              {t("instructorDetailPage.payments.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("instructorDetailPage.payments.description")}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("instructorDetailPage.payments.stats.profileType")}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {isExternal
                  ? t("instructorDetailPage.payments.profileType.external")
                  : t("instructorDetailPage.payments.profileType.internal")}
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("instructorDetailPage.payments.stats.bankAccount")}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {bankForm.account_number.trim() ||
                  t("instructorDetailPage.common.notUpdated")}
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("instructorDetailPage.payments.stats.accountHolder")}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {bankForm.account_holder.trim() ||
                  t("instructorDetailPage.common.notUpdated")}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            <label className="text-sm font-medium">
              {t("instructorDetailPage.payments.fields.bankName")}
            </label>
            <Input
              value={bankForm.bank_name}
              onChange={(e) =>
                setBankForm((prev) => ({
                  ...prev,
                  bank_name: e.target.value,
                }))
              }
              placeholder={t("instructorDetailPage.payments.fields.bankNamePlaceholder")}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                {t("instructorDetailPage.payments.fields.accountNumber")}
              </label>
              <Input
                value={bankForm.account_number}
                onChange={(e) =>
                  setBankForm((prev) => ({
                    ...prev,
                    account_number: e.target.value,
                  }))
                }
                placeholder={t("instructorDetailPage.payments.fields.accountNumberPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                {t("instructorDetailPage.payments.fields.accountHolder")}
              </label>
              <Input
                value={bankForm.account_holder}
                onChange={(e) =>
                  setBankForm((prev) => ({
                    ...prev,
                    account_holder: e.target.value,
                  }))
                }
                placeholder={t("instructorDetailPage.payments.fields.accountHolderPlaceholder")}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <label className="text-sm font-medium">
              {t("instructorDetailPage.payments.fields.transferNote")}
            </label>
            <Input
              value={bankForm.transfer_note}
              onChange={(e) =>
                setBankForm((prev) => ({
                  ...prev,
                  transfer_note: e.target.value,
                }))
              }
              placeholder={t("instructorDetailPage.payments.fields.transferNotePlaceholder")}
            />
          </div>

          <div className="mt-4 grid gap-2">
            <label className="text-sm font-medium">
              {t("instructorDetailPage.payments.fields.extraNotes")}
            </label>
            <textarea
              rows={6}
              value={transferInfo}
              onChange={(e) => setTransferInfo(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t("instructorDetailPage.payments.fields.extraNotesPlaceholder")}
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving
                ? t("instructorDetailPage.payments.actions.saving")
                : t("instructorDetailPage.payments.actions.save")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

