import { Input } from "@/components/ui/input";
import { InstructorDocumentList } from "@/features/admin/instructors/components/InstructorDocumentList";
import type { PartnerProfileDocument } from "@/types/database";
import type { TFunction } from "i18next";

export function ContractsSection({
  t,
  isExternal,
  uploading,
  contractDocs,
  contractNoteDraft,
  setContractNoteDraft,
  onUpload,
}: {
  t: TFunction<"admin">;
  isExternal: boolean;
  uploading: boolean;
  contractDocs: PartnerProfileDocument[];
  contractNoteDraft: string;
  setContractNoteDraft: (value: string) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base p-6">
      {!isExternal ? (
        <p className="text-sm text-foreground-muted">
          {t("instructorDetailPage.contracts.externalOnly")}
        </p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-foreground">
                {t("instructorDetailPage.contracts.title")}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {t("instructorDetailPage.contracts.description")}
              </p>
            </div>
            <span className="rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs text-foreground-muted">
              {t("instructorDetailPage.contracts.countLabel", {
                count: contractDocs.length,
              })}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm font-medium">
                {t("instructorDetailPage.contracts.noteLabel")}
              </label>
              <Input
                value={contractNoteDraft}
                onChange={(e) => setContractNoteDraft(e.target.value)}
                placeholder={t("instructorDetailPage.contracts.notePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                {t("instructorDetailPage.contracts.uploadLabel")}
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
              docs={contractDocs}
              emptyLabel={t("instructorDetailPage.contracts.empty")}
              renderMeta={(doc) => doc.note || t("instructorDetailPage.contracts.noNote")}
            />
          </div>
        </>
      )}
    </section>
  );
}

