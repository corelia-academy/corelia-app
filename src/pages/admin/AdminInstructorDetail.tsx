import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { getAllProfiles, updateProfileAdmin } from "@/lib/profile";
import { uploadInstructorPartnerDocument } from "@/lib/storage";
import { useAuth } from "@/stores/authStore";
import type { PartnerProfileDocument, Profile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bank,
  CreditCard,
  FileText,
  Gear,
  Receipt,
  ShieldCheck,
  UserCircle,
} from "@phosphor-icons/react";

type InstructorOrigin = NonNullable<Profile["instructor_origin"]>;

type InstructorEditForm = {
  role: Profile["role"];
  instructor_origin: InstructorOrigin;
  full_name: string;
  email: string;
  phone: string;
  instructor_organization: string;
  instructor_headline: string;
  instructor_bio: string;
  instructor_website: string;
};

const INSTRUCTOR_DETAIL_SECTION_IDS = [
  "profile",
  "contracts",
  "invoices",
  "payments",
] as const;

type SectionId = (typeof INSTRUCTOR_DETAIL_SECTION_IDS)[number];

function SectionButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string; weight?: "duotone" }>;
  label: string;
  onClick: () => void;
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >
      <Icon className="size-4 shrink-0" weight="duotone" />
      {label}
    </button>
  );
}

function DocumentList({
  docs,
  emptyLabel,
  renderMeta,
}: {
  docs: PartnerProfileDocument[];
  emptyLabel: string;
  renderMeta: (doc: PartnerProfileDocument) => React.ReactNode;
}) {
  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {docs
        .slice()
        .reverse()
        .map((doc) => (
          <li
            key={doc.path}
            className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-muted/25 px-3 py-3"
          >
            <div className="min-w-0">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
                title={doc.name}
              >
                {doc.name}
              </a>
              <div className="text-xs text-muted-foreground">{renderMeta(doc)}</div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(doc.uploaded_at).toLocaleDateString("vi-VN")}
            </span>
          </li>
        ))}
    </ul>
  );
}

export default function AdminInstructorDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile: currentProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingTransferCourseId, setSavingTransferCourseId] = useState<
    string | null
  >(null);
  const [uploadingPartnerDoc, setUploadingPartnerDoc] = useState<{
    kind: "contract" | "invoice";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
  const [bankForm, setBankForm] = useState({
    bank_name: "",
    account_number: "",
    account_holder: "",
    transfer_note: "",
  });

  const sectionIds = INSTRUCTOR_DETAIL_SECTION_IDS as readonly SectionId[];
  const [activeSection, setActiveSection] = useState<SectionId>(() => {
    const hash =
      typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    return (sectionIds.includes(hash as SectionId) ? hash : "profile") as SectionId;
  });

  const setSection = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    window.location.hash = sectionId;
  };

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (sectionIds.includes(hash as SectionId)) {
        setActiveSection(hash as SectionId);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [sectionIds]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAllProfiles()
      .then((profilesData) => {
        if (!cancelled) {
          setProfiles(profilesData);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không thể tải dữ liệu");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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
      toast.success("Đã lưu thông tin giảng viên.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu cập nhật");
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
          ? "Đã tải lên hợp đồng cho giảng viên."
          : "Đã tải lên hoá đơn cho giảng viên.",
      );

      if (kind === "invoice") setInvoiceNoteDraft("");
      if (kind === "contract") setContractNoteDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải tài liệu");
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
      toast.success("Đã cập nhật thông tin thanh toán.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu thanh toán");
    } finally {
      setSavingTransferCourseId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1990px] px-4 py-8 text-sm text-muted-foreground">
        Đang tải chi tiết giảng viên...
      </div>
    );
  }

  if (!instructor || !editForm) {
    return (
      <div className="mx-auto w-full max-w-[1990px] px-4 py-8">
        <p className="text-sm text-muted-foreground">Không tìm thấy giảng viên.</p>
        <Link
          to="/admin/instructors"
          className="mt-3 inline-flex text-sm text-primary hover:underline"
        >
          Quay lại danh sách
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
      label: "Hồ sơ hoàn thiện",
      value: `${profileCompletionPercent}%`,
      icon: UserCircle,
    },
    { label: "Hợp đồng", value: String(contractDocs.length), icon: FileText },
    { label: "Hoá đơn", value: String(invoiceDocs.length), icon: Receipt },
    {
      label: "Tài khoản ngân hàng",
      value: bankForm.account_number.trim() ? "Sẵn sàng" : "Chưa có",
      icon: Bank,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mb-6">
        <Link
          to="/admin/instructors"
          className="text-sm text-primary hover:underline"
        >
          ← Quay lại danh sách giảng viên
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Instructor workspace
                </p>
                <h1 className="mt-2 truncate text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
                  {displayName}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  UID: <span className="font-mono">{instructor.id}</span>
                </p>
                <p className="mt-2 max-w-3xl text-[14px] text-muted-foreground sm:text-[15px]">
                  Quản lý hồ sơ giảng viên, tài liệu đối tác và thông tin thanh
                  toán trong một luồng vận hành rõ ràng hơn.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                Role: {editForm.role}
              </span>
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                {isExternal ? "Giảng viên đối tác" : "Giảng viên Corelia"}
              </span>
              {editForm.instructor_organization ? (
                <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
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
                      <Icon className="size-5" weight="duotone" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row">
        <nav className="h-fit shrink-0 rounded-2xl border border-border-subtle bg-card p-3 shadow-card xl:sticky xl:top-24 xl:w-72">
          <div className="mb-3 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Điều hướng hồ sơ
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Chuyển nhanh giữa thông tin cá nhân, tài liệu đối tác và thanh toán.
            </p>
          </div>

          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
            <li>
              <SectionButton
                active={activeSection === "profile"}
                icon={Gear}
                label="Thông tin giảng viên"
                onClick={() => setSection("profile")}
              />
            </li>
            <li className="mt-2 border-t border-border-subtle pt-2">
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Đối tác
              </div>
            </li>
            <li>
              <SectionButton
                active={activeSection === "contracts"}
                disabled={!isExternal}
                icon={FileText}
                label="Hợp đồng"
                onClick={() => setSection("contracts")}
              />
            </li>
            <li>
              <SectionButton
                active={activeSection === "invoices"}
                disabled={!isExternal}
                icon={Receipt}
                label="Hoá đơn"
                onClick={() => setSection("invoices")}
              />
            </li>
            <li>
              <SectionButton
                active={activeSection === "payments"}
                disabled={!isExternal}
                icon={CreditCard}
                label="Thanh toán"
                onClick={() => setSection("payments")}
              />
            </li>
          </ul>

          <div className="mt-4 rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <p className="text-[12px] font-medium text-foreground">
              {isExternal ? "Đang ở chế độ đối tác" : "Giảng viên nội bộ"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {isExternal
                ? "Các section hợp đồng, hoá đơn và thanh toán đang được mở để quản trị đối soát."
                : "Các section đối tác sẽ tự khoá vì hồ sơ này không dùng quy trình thanh toán đối tác."}
            </p>
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {activeSection === "profile" ? (
            <section className="rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium text-foreground">
                    Thông tin giảng viên
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cập nhật hồ sơ công khai, vai trò hệ thống và thông tin chuyên môn.
                  </p>
                </div>
                <div className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                  <ShieldCheck
                    className="mr-1.5 size-4 text-primary"
                    weight="duotone"
                  />
                  {profileCompletionPercent}% hoàn thiện
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Vai trò</label>
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, role: e.target.value as Profile["role"] }
                          : prev,
                      )
                    }
                    className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="instructor">Giảng viên</option>
                    <option value="support_staff">Học vụ</option>
                    <option value="admin">Admin</option>
                    <option value="student">Học viên</option>
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Loại giảng viên</label>
                  <select
                    value={editForm.instructor_origin}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              instructor_origin: e.target.value as InstructorOrigin,
                            }
                          : prev,
                      )
                    }
                    className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="corelia">Corelia</option>
                    <option value="external">Bên ngoài</option>
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Họ tên</label>
                  <Input
                    value={editForm.full_name}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, full_name: e.target.value } : prev,
                      )
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, email: e.target.value } : prev,
                      )
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Số điện thoại</label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, phone: e.target.value } : prev,
                      )
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Đơn vị công tác</label>
                  <Input
                    value={editForm.instructor_organization}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              instructor_organization: e.target.value,
                            }
                          : prev,
                      )
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Headline</label>
                  <Input
                    value={editForm.instructor_headline}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, instructor_headline: e.target.value }
                          : prev,
                      )
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Website / LinkedIn</label>
                  <Input
                    value={editForm.instructor_website}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, instructor_website: e.target.value }
                          : prev,
                      )
                    }
                  />
                </div>

                <div className="grid gap-1.5 lg:col-span-2">
                  <label className="text-sm font-medium">Bio</label>
                  <textarea
                    value={editForm.instructor_bio}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, instructor_bio: e.target.value } : prev,
                      )
                    }
                    rows={5}
                    className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="flex justify-end lg:col-span-2">
                  <Button
                    type="button"
                    onClick={() => void handleSaveDetails()}
                    disabled={savingDetails}
                  >
                    {savingDetails ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "contracts" ? (
            <section className="rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
              {!isExternal ? (
                <p className="text-sm text-muted-foreground">
                  Chỉ áp dụng cho giảng viên đối tác bên ngoài.
                </p>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-medium text-foreground">
                        Hợp đồng
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Upload hợp đồng đã ký offline. File sẽ được lưu ngay và hiển
                        thị cho giảng viên.
                      </p>
                    </div>
                    <span className="rounded-full border border-border-subtle bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                      {contractDocs.length} file
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Ghi chú (tuỳ chọn)</label>
                      <Input
                        value={contractNoteDraft}
                        onChange={(e) => setContractNoteDraft(e.target.value)}
                        placeholder="Ví dụ: HĐ CTV giảng viên, số hợp đồng, ngày ký..."
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Upload hợp đồng</label>
                      <input
                        type="file"
                        className="block w-full text-xs"
                        disabled={uploadingPartnerDoc?.kind === "contract"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleUploadPartnerDocument("contract", file);
                          }
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <DocumentList
                      docs={contractDocs}
                      emptyLabel="Chưa có tài liệu hợp đồng."
                      renderMeta={(doc) => doc.note || "Không có ghi chú"}
                    />
                  </div>
                </>
              )}
            </section>
          ) : null}

          {activeSection === "invoices" ? (
            <section className="rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
              {!isExternal ? (
                <p className="text-sm text-muted-foreground">
                  Chỉ áp dụng cho giảng viên đối tác bên ngoài.
                </p>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-medium text-foreground">
                        Hoá đơn
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Upload hoá đơn/đối soát. File sẽ được lưu ngay và hiển thị
                        cho giảng viên.
                      </p>
                    </div>
                    <span className="rounded-full border border-border-subtle bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                      {invoiceDocs.length} file
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Tháng hoá đơn</label>
                      <Input
                        type="month"
                        value={invoiceMonthDraft}
                        onChange={(e) => setInvoiceMonthDraft(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <label className="text-sm font-medium">Ghi chú (tuỳ chọn)</label>
                      <Input
                        value={invoiceNoteDraft}
                        onChange={(e) => setInvoiceNoteDraft(e.target.value)}
                        placeholder="Ví dụ: Kỳ đối soát, số hoá đơn..."
                      />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-3">
                      <label className="text-sm font-medium">Upload hoá đơn</label>
                      <input
                        type="file"
                        className="block w-full text-xs"
                        disabled={uploadingPartnerDoc?.kind === "invoice"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleUploadPartnerDocument("invoice", file);
                          }
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <DocumentList
                      docs={invoiceDocs}
                      emptyLabel="Chưa có tài liệu hoá đơn."
                      renderMeta={(doc) => (
                        <>
                          {doc.invoice_month ? `Tháng ${doc.invoice_month}` : "—"}
                          {doc.note ? ` · ${doc.note}` : ""}
                        </>
                      )}
                    />
                  </div>
                </>
              )}
            </section>
          ) : null}

          {activeSection === "payments" ? (
            <section className="rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
              {!isExternal ? (
                <p className="text-sm text-muted-foreground">
                  Chỉ áp dụng cho giảng viên đối tác bên ngoài.
                </p>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-medium text-foreground">
                      Thanh toán
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Thông tin chuyển khoản hiển thị cho giảng viên ở mục “Thanh
                      toán”.
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Loại hồ sơ
                      </p>
                      <p className="mt-2 text-[15px] font-medium text-foreground">
                        {isExternal ? "Đối tác bên ngoài" : "Nội bộ"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Tài khoản ngân hàng
                      </p>
                      <p className="mt-2 text-[15px] font-medium text-foreground">
                        {bankForm.account_number.trim() || "Chưa cập nhật"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Chủ tài khoản
                      </p>
                      <p className="mt-2 text-[15px] font-medium text-foreground">
                        {bankForm.account_holder.trim() || "Chưa cập nhật"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-1.5">
                    <label className="text-sm font-medium">Ngân hàng</label>
                    <Input
                      value={bankForm.bank_name}
                      onChange={(e) =>
                        setBankForm((prev) => ({
                          ...prev,
                          bank_name: e.target.value,
                        }))
                      }
                      placeholder="Ví dụ: Vietcombank"
                    />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Số tài khoản</label>
                      <Input
                        value={bankForm.account_number}
                        onChange={(e) =>
                          setBankForm((prev) => ({
                            ...prev,
                            account_number: e.target.value,
                          }))
                        }
                        placeholder="0123456789"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Chủ tài khoản</label>
                      <Input
                        value={bankForm.account_holder}
                        onChange={(e) =>
                          setBankForm((prev) => ({
                            ...prev,
                            account_holder: e.target.value,
                          }))
                        }
                        placeholder="NGUYEN VAN A"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-1.5">
                    <label className="text-sm font-medium">
                      Nội dung chuyển khoản (tuỳ chọn)
                    </label>
                    <Input
                      value={bankForm.transfer_note}
                      onChange={(e) =>
                        setBankForm((prev) => ({
                          ...prev,
                          transfer_note: e.target.value,
                        }))
                      }
                      placeholder="Ví dụ: Corelia - đối soát tháng 03/2026"
                    />
                  </div>

                  <div className="mt-4 grid gap-1.5">
                    <label className="text-sm font-medium">
                      Ghi chú thêm (tuỳ chọn)
                    </label>
                    <textarea
                      rows={6}
                      value={transferInfo}
                      onChange={(e) => setTransferInfo(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Ví dụ: Điều kiện thanh toán, thời hạn đối soát, email nhận hoá đơn..."
                    />
                  </div>

                  <div className="mt-5 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        void handleSaveTransferInfo();
                        void handleSaveDetails();
                      }}
                      disabled={savingTransferCourseId === instructor.id}
                    >
                      {savingTransferCourseId === instructor.id
                        ? "Đang lưu..."
                        : "Lưu thanh toán"}
                    </Button>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
