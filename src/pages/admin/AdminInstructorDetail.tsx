import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { updateProfileAdmin } from "@/lib/profile";
import { uploadInstructorPartnerDocument } from "@/lib/storage";
import { useAuth } from "@/stores/authStore";
import type { PartnerProfileDocument } from "@/types/database";
import { toast } from "sonner";
import {
  CreditCard,
  FileText,
  Landmark,
  Receipt,
  Settings,
  UserCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHashSection } from "@/features/admin/instructors/hooks/useHashSection";
import { InstructorSectionButton } from "@/features/admin/instructors/components/InstructorSectionButton";
import { useAdminProfiles } from "@/features/admin/users/hooks/useAdminProfiles";
import {
  ProfileSection,
  type InstructorEditForm,
} from "@/features/admin/instructors/detail/sections/ProfileSection";
import { ContractsSection } from "@/features/admin/instructors/detail/sections/ContractsSection";
import { InvoicesSection } from "@/features/admin/instructors/detail/sections/InvoicesSection";
import {
  PaymentsSection,
  type PartnerBankForm,
} from "@/features/admin/instructors/detail/sections/PaymentsSection";

const INSTRUCTOR_DETAIL_SECTION_IDS = [
  "profile",
  "contracts",
  "invoices",
  "payments",
] as const;

type SectionId = (typeof INSTRUCTOR_DETAIL_SECTION_IDS)[number];

export default function AdminInstructorDetail() {
  const { t } = useTranslation("admin");
  const { id } = useParams<{ id: string }>();
  const { profile: currentProfile } = useAuth();
  const { profiles, setProfiles, loading, error, setError } = useAdminProfiles({
    fallbackErrorMessage: t("instructorDetailPage.errors.loadFailed"),
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingTransferCourseId, setSavingTransferCourseId] = useState<
    string | null
  >(null);
  const [uploadingPartnerDoc, setUploadingPartnerDoc] = useState<{
    kind: "contract" | "invoice";
  } | null>(null);
  const [editForm, setEditForm] = useState<InstructorEditForm | null>(null);
  const [contractDocs, setContractDocs] = useState<PartnerProfileDocument[]>([]);
  const [invoiceDocs, setInvoiceDocs] = useState<PartnerProfileDocument[]>([]);
  const [transferInfo, setTransferInfo] = useState("");
  const [invoiceMonthDraft, setInvoiceMonthDraft] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [invoiceNoteDraft, setInvoiceNoteDraft] = useState("");
  const [contractNoteDraft, setContractNoteDraft] = useState("");
  const [bankForm, setBankForm] = useState<PartnerBankForm>({
    bank_name: "",
    account_number: "",
    account_holder: "",
    transfer_note: "",
  });

  const sectionIds = INSTRUCTOR_DETAIL_SECTION_IDS as readonly SectionId[];
  const { activeSection, setSection } = useHashSection<SectionId>({
    sectionIds,
    defaultSection: "profile",
  });

  const instructor = useMemo(() => {
    if (!id) return null;
    return profiles.find((p) => p.id === id) ?? null;
  }, [profiles, id]);

  useEffect(() => {
    if (!instructor) {
      setEditForm(null);
      setContractDocs([]);
      setInvoiceDocs([]);
      setTransferInfo("");
      setInvoiceNoteDraft("");
      setContractNoteDraft("");
      setBankForm({
        bank_name: "",
        account_number: "",
        account_holder: "",
        transfer_note: "",
      });
      return;
    }

    setEditForm({
      role: instructor.role,
      instructor_origin: instructor.instructor_origin ?? "external",
      full_name: instructor.full_name ?? "",
      email: instructor.email ?? "",
      phone: instructor.phone ?? "",
      instructor_organization: instructor.instructor_organization ?? "",
      instructor_headline: instructor.instructor_headline ?? "",
      instructor_bio: instructor.instructor_bio ?? "",
      instructor_website: instructor.instructor_website ?? "",
    });
    setContractDocs(instructor.partner_contract_docs ?? []);
    setInvoiceDocs(instructor.partner_invoice_docs ?? []);
    setTransferInfo(instructor.partner_transfer_info ?? "");
    setBankForm({
      bank_name: instructor.partner_bank_name ?? "",
      account_number: instructor.partner_bank_account_number ?? "",
      account_holder: instructor.partner_bank_account_holder ?? "",
      transfer_note: instructor.partner_bank_transfer_note ?? "",
    });
  }, [instructor]);

  async function handleSaveDetails() {
    if (!instructor || !editForm) return;
    setSavingDetails(true);
    setError(null);

    try {
      await updateProfileAdmin(instructor.id, {
        role: editForm.role,
        instructor_origin: editForm.instructor_origin,
        full_name: editForm.full_name.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        instructor_organization: editForm.instructor_organization.trim() || null,
        instructor_headline: editForm.instructor_headline.trim() || null,
        instructor_bio: editForm.instructor_bio.trim() || null,
        instructor_website: editForm.instructor_website.trim() || null,
        partner_contract_docs: contractDocs,
        partner_invoice_docs: invoiceDocs,
        partner_transfer_info: transferInfo.trim() || null,
        partner_bank_name: bankForm.bank_name.trim() || null,
        partner_bank_account_number: bankForm.account_number.trim() || null,
        partner_bank_account_holder: bankForm.account_holder.trim() || null,
        partner_bank_transfer_note: bankForm.transfer_note.trim() || null,
      });

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === instructor.id
            ? {
                ...p,
                role: editForm.role,
                instructor_origin: editForm.instructor_origin,
                full_name: editForm.full_name.trim() || null,
                email: editForm.email.trim() || null,
                phone: editForm.phone.trim() || null,
                instructor_organization: editForm.instructor_organization.trim() || null,
                instructor_headline: editForm.instructor_headline.trim() || null,
                instructor_bio: editForm.instructor_bio.trim() || null,
                instructor_website: editForm.instructor_website.trim() || null,
                partner_contract_docs: contractDocs,
                partner_invoice_docs: invoiceDocs,
                partner_transfer_info: transferInfo.trim() || null,
                partner_bank_name: bankForm.bank_name.trim() || null,
                partner_bank_account_number: bankForm.account_number.trim() || null,
                partner_bank_account_holder: bankForm.account_holder.trim() || null,
                partner_bank_transfer_note: bankForm.transfer_note.trim() || null,
                updated_at: new Date().toISOString(),
              }
            : p,
        ),
      );
      toast.success(t("instructorDetailPage.toasts.detailsSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("instructorDetailPage.errors.saveFailed"));
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleUploadPartnerDocument(
    kind: "contract" | "invoice",
    file: File,
  ) {
    if (!instructor) return;
    setUploadingPartnerDoc({ kind });

    try {
      const uploaded = await uploadInstructorPartnerDocument(instructor.id, kind, file);
      const nextDoc: PartnerProfileDocument = {
        name: file.name,
        url: uploaded.url,
        path: uploaded.path,
        uploaded_at: new Date().toISOString(),
        uploaded_by: currentProfile?.id ?? "system",
        invoice_month: kind === "invoice" ? invoiceMonthDraft : null,
        note:
          kind === "invoice"
            ? (invoiceNoteDraft.trim() || null)
            : (contractNoteDraft.trim() || null),
      };

      const nextContracts =
        kind === "contract" ? [...contractDocs, nextDoc] : contractDocs;
      const nextInvoices = kind === "invoice" ? [...invoiceDocs, nextDoc] : invoiceDocs;

      await updateProfileAdmin(instructor.id, {
        partner_contract_docs: nextContracts,
        partner_invoice_docs: nextInvoices,
      });

      setContractDocs(nextContracts);
      setInvoiceDocs(nextInvoices);
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === instructor.id
            ? {
                ...p,
                partner_contract_docs: nextContracts,
                partner_invoice_docs: nextInvoices,
              }
            : p,
        ),
      );

      toast.success(
        kind === "contract"
          ? t("instructorDetailPage.toasts.contractUploaded")
          : t("instructorDetailPage.toasts.invoiceUploaded"),
      );

      if (kind === "invoice") setInvoiceNoteDraft("");
      if (kind === "contract") setContractNoteDraft("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("instructorDetailPage.errors.uploadFailed"),
      );
    } finally {
      setUploadingPartnerDoc(null);
    }
  }

  async function handleSaveTransferInfo() {
    if (!instructor) return;
    const normalizedTransfer = transferInfo.trim();
    setSavingTransferCourseId(instructor.id);

    try {
      await updateProfileAdmin(instructor.id, {
        partner_transfer_info: normalizedTransfer || null,
      });
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === instructor.id
            ? { ...p, partner_transfer_info: normalizedTransfer || null }
            : p,
        ),
      );
      toast.success(t("instructorDetailPage.toasts.paymentsSaved"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("instructorDetailPage.errors.paymentsSaveFailed"),
      );
    } finally {
      setSavingTransferCourseId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1990px] px-4 py-8 text-sm text-muted-foreground">
        {t("instructorDetailPage.loading")}
      </div>
    );
  }

  if (!instructor || !editForm) {
    return (
      <div className="mx-auto w-full max-w-[1990px] px-4 py-8">
        <p className="text-sm text-muted-foreground">
          {t("instructorDetailPage.empty.notFound")}
        </p>
        <Link
          to="/admin/instructors"
          className="mt-3 inline-flex text-sm text-primary hover:underline"
        >
          {t("instructorDetailPage.actions.backToList")}
        </Link>
      </div>
    );
  }

  const displayName = instructor.full_name || instructor.email || instructor.id;
  const isExternal = editForm.instructor_origin === "external";
  const completedProfileFields = [
    editForm.full_name,
    editForm.email,
    editForm.phone,
    editForm.instructor_organization,
    editForm.instructor_headline,
    editForm.instructor_bio,
    editForm.instructor_website,
  ].filter((value) => value.trim()).length;
  const profileCompletionPercent = Math.round((completedProfileFields / 7) * 100);
  const summaryCards = [
    {
      label: t("instructorDetailPage.summary.profileCompletion"),
      value: `${profileCompletionPercent}%`,
      icon: UserCircle,
    },
    {
      label: t("instructorDetailPage.summary.contracts"),
      value: String(contractDocs.length),
      icon: FileText,
    },
    {
      label: t("instructorDetailPage.summary.invoices"),
      value: String(invoiceDocs.length),
      icon: Receipt,
    },
    {
      label: t("instructorDetailPage.summary.bankAccount"),
      value: bankForm.account_number.trim()
        ? t("instructorDetailPage.summary.ready")
        : t("instructorDetailPage.summary.notAvailable"),
      icon: Landmark,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mb-6">
        <Link
          to="/admin/instructors"
          className="text-sm text-primary hover:underline"
        >
          {t("instructorDetailPage.actions.backToInstructors")}
        </Link>
        <div className="mt-4 rounded-2xl border border-border-subtle bg-card p-5 shadow-card">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {instructor.avatar_url ? (
                <img
                  src={instructor.avatar_url}
                  alt=""
                  className="size-16 shrink-0 rounded-2xl border border-border-subtle bg-muted/60 object-cover"
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border-subtle bg-muted/60 text-xl font-medium text-muted-foreground">
                  {(displayName || "I")[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("instructorDetailPage.hero.eyebrow")}
                </p>
                <h1 className="mt-2 truncate text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
                  {displayName}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  UID: <span className="font-mono">{instructor.id}</span>
                </p>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-sm">
                  {t("instructorDetailPage.hero.description")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                {t("instructorDetailPage.hero.rolePrefix", { role: editForm.role })}
              </span>
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                {isExternal
                  ? t("instructorDetailPage.hero.partnerInstructor")
                  : t("instructorDetailPage.hero.coreliaInstructor")}
              </span>
              {editForm.instructor_organization ? (
                <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                  {editForm.instructor_organization}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-2xl border border-border-subtle bg-muted/25 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {card.label}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {card.value}
                      </p>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row">
        <nav className="h-fit shrink-0 rounded-2xl border border-border-subtle bg-card p-3 shadow-card xl:sticky xl:top-24 xl:w-72">
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("instructorDetailPage.nav.title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("instructorDetailPage.nav.subtitle")}
            </p>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <li>
              <InstructorSectionButton
                active={activeSection === "profile"}
                icon={Settings}
                label={t("instructorDetailPage.sections.profile")}
                onClick={() => setSection("profile")}
              />
            </li>
            <li className="mt-2 border-t border-border-subtle pt-2">
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("instructorDetailPage.sections.partnerGroup")}
              </div>
            </li>
            <li>
              <InstructorSectionButton
                active={activeSection === "contracts"}
                disabled={!isExternal}
                icon={FileText}
                label={t("instructorDetailPage.sections.contracts")}
                onClick={() => setSection("contracts")}
              />
            </li>
            <li>
              <InstructorSectionButton
                active={activeSection === "invoices"}
                disabled={!isExternal}
                icon={Receipt}
                label={t("instructorDetailPage.sections.invoices")}
                onClick={() => setSection("invoices")}
              />
            </li>
            <li>
              <InstructorSectionButton
                active={activeSection === "payments"}
                disabled={!isExternal}
                icon={CreditCard}
                label={t("instructorDetailPage.sections.payments")}
                onClick={() => setSection("payments")}
              />
            </li>
          </ul>

          <div className="mt-4 rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-xs font-medium text-foreground">
              {isExternal
                ? t("instructorDetailPage.partnerMode.titleOn")
                : t("instructorDetailPage.partnerMode.titleOff")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isExternal
                ? t("instructorDetailPage.partnerMode.descriptionOn")
                : t("instructorDetailPage.partnerMode.descriptionOff")}
            </p>
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {activeSection === "profile" ? (
            <ProfileSection
              t={t}
              editForm={editForm}
              setEditForm={setEditForm}
              profileCompletionPercent={profileCompletionPercent}
              savingDetails={savingDetails}
              onSave={() => void handleSaveDetails()}
            />
          ) : null}

          {activeSection === "contracts" ? (
            <ContractsSection
              t={t}
              isExternal={isExternal}
              uploading={uploadingPartnerDoc?.kind === "contract"}
              contractDocs={contractDocs}
              contractNoteDraft={contractNoteDraft}
              setContractNoteDraft={setContractNoteDraft}
              onUpload={(file) => void handleUploadPartnerDocument("contract", file)}
            />
          ) : null}

          {activeSection === "invoices" ? (
            <InvoicesSection
              t={t}
              isExternal={isExternal}
              uploading={uploadingPartnerDoc?.kind === "invoice"}
              invoiceDocs={invoiceDocs}
              invoiceMonthDraft={invoiceMonthDraft}
              setInvoiceMonthDraft={setInvoiceMonthDraft}
              invoiceNoteDraft={invoiceNoteDraft}
              setInvoiceNoteDraft={setInvoiceNoteDraft}
              onUpload={(file) => void handleUploadPartnerDocument("invoice", file)}
            />
          ) : null}

          {activeSection === "payments" ? (
            <PaymentsSection
              t={t}
              isExternal={isExternal}
              bankForm={bankForm}
              setBankForm={setBankForm}
              transferInfo={transferInfo}
              setTransferInfo={setTransferInfo}
              saving={savingTransferCourseId === instructor.id}
              onSave={() => {
                void handleSaveTransferInfo();
                void handleSaveDetails();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
