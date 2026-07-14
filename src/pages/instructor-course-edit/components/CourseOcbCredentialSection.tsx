import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, LockKeyhole, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  countIssuancesForTemplate,
  getLatestCourseCredentialTemplate,
  saveCourseCredentialTemplate,
  type CourseCredentialKind,
  type CourseCredentialTriggerRule,
} from "@/lib/credentialTemplates";
import { uploadCourseCredentialBadgeImage, uploadOnchainCertificateTemplate } from "@/lib/storage";
import { toast } from "sonner";
import { validatePngSignature } from "@/lib/imageValidation";

function InvalidPngToast() {
  return (
    <span>
      Định dạng file không phải PNG. Vui lòng tách nền hoặc chuyển đổi ảnh tại{" "}
      <a href="https://www.remove.bg" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-primary-foreground hover:opacity-85">
        remove.bg
      </a>
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation("instructor");
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <CheckCircle2 className="size-3.5" aria-hidden />
        {t("courseEdit.ocb.statusActive")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground-muted border border-border-subtle">
      {t("courseEdit.ocb.statusInactive")}
    </span>
  );
}

function SectionToggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${checked ? "bg-primary" : "bg-border"}`}
    >
      <span
        className={`pointer-events-none inline-block size-5 rounded-full bg-primary-foreground shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

type KindOption = {
  value: CourseCredentialKind;
  labelKey: string;
  descKey: string;
};

const KIND_OPTIONS: KindOption[] = [
  { value: "oca", labelKey: "courseEdit.ocb.kind.oca.label", descKey: "courseEdit.ocb.kind.oca.desc" },
  { value: "ocb", labelKey: "courseEdit.ocb.kind.ocb.label", descKey: "courseEdit.ocb.kind.ocb.desc" },
];

export function CourseOcbCredentialSection({
  courseId,
  courseSlug,
  canEdit,
  hasCertificate = false,
  onActiveChange,
  onDirtyChange,
  onClearLegacyCertificate,
  onchainCertificateTemplateUrl,
  onchainCertificateTemplatePath,
  onOnchainCertificateUploaded,
  onClearOnchainCertificate,
}: {
  courseId: string;
  courseSlug: string;
  canEdit: boolean;
  hasCertificate?: boolean;
  onActiveChange?: (active: boolean) => void;
  /** Reports whether there are unsaved OCA/OCB edits, so the parent can warn
   *  before switching away from this tab. */
  onDirtyChange?: (dirty: boolean) => void;
  onClearLegacyCertificate?: () => void;
  /** On-chain OCA (Open Campus Achievement) art — must stay name-free (OC privacy rules),
   *  minted to Open Campus/IPFS. Distinct from the off-chain `certificate_template_url`
   *  (Card 1), which gets the learner's name stamped client-side for social sharing. */
  onchainCertificateTemplateUrl?: string | null;
  onchainCertificateTemplatePath?: string | null;
  onOnchainCertificateUploaded?: (result: { url: string; path: string }) => void;
  onClearOnchainCertificate?: () => void;
}) {
  const { t } = useTranslation("instructor");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  /** Lets the Save button reveal the (never-configured) body for viewing
   *  without touching `isActive` — purely local, never persisted. Only
   *  matters while `templateId` is null; reset once the master toggle turns
   *  on for real so it can't linger and force-expand the card later. */
  const [peekExpanded, setPeekExpanded] = useState(false);
  const [credentialKind, setCredentialKind] = useState<CourseCredentialKind>("oca");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [identifierPrefix, setIdentifierPrefix] = useState("");
  const [issuanceCount, setIssuanceCount] = useState(0);
  const [completionPct, setCompletionPct] = useState(100);
  const [requireAssignmentPass, setRequireAssignmentPass] = useState(false);
  const [minAssignmentScore, setMinAssignmentScore] = useState(70);

  /** Snapshot of the last loaded/saved field values, used to detect unsaved
   *  edits (`isDirty` below). A ref because it's only ever read during
   *  render, not something that should itself trigger a re-render. */
  const savedSnapshotRef = useRef<{
    isActive: boolean;
    credentialKind: CourseCredentialKind;
    name: string;
    description: string;
    imageUrl: string;
    identifierPrefix: string;
    completionPct: number;
    requireAssignmentPass: boolean;
    minAssignmentScore: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getLatestCourseCredentialTemplate(courseId);
      if (!row) {
        const freshIdentifierPrefix = `corelia:${courseSlug}`.slice(0, 40);
        setTemplateId(null);
        setIsActive(false);
        setCredentialKind("oca");
        setName("");
        setDescription("");
        setImageUrl("");
        setIdentifierPrefix(freshIdentifierPrefix);
        setCompletionPct(100);
        setRequireAssignmentPass(false);
        setMinAssignmentScore(70);
        setIssuanceCount(0);
        savedSnapshotRef.current = {
          isActive: false,
          credentialKind: "oca",
          name: "",
          description: "",
          imageUrl: "",
          identifierPrefix: freshIdentifierPrefix,
          completionPct: 100,
          requireAssignmentPass: false,
          minAssignmentScore: 70,
        };
        // Report against the *saved* state, not whatever's being drafted in
        // the form — a brand-new course has nothing active yet regardless.
        onActiveChange?.(false);
        return;
      }
      const kind: CourseCredentialKind = row.collection_symbol ? "ocb" : "oca";
      const tr = row.trigger_rule as CourseCredentialTriggerRule | null;
      const loaded = {
        isActive: row.is_active,
        credentialKind: kind,
        name: row.name ?? "",
        description: row.description ?? "",
        imageUrl: row.image_url ?? "",
        identifierPrefix: row.identifier_prefix ?? "",
        completionPct: Number(tr?.completion_pct ?? 100),
        requireAssignmentPass: tr?.require_assignment_pass === true,
        minAssignmentScore: Number(tr?.min_assignment_score ?? 70),
      };
      setTemplateId(row.id);
      setIsActive(loaded.isActive);
      setCredentialKind(loaded.credentialKind);
      setName(loaded.name);
      setDescription(loaded.description);
      setImageUrl(loaded.imageUrl);
      setIdentifierPrefix(loaded.identifierPrefix);
      setCompletionPct(loaded.completionPct);
      setRequireAssignmentPass(loaded.requireAssignmentPass);
      setMinAssignmentScore(loaded.minAssignmentScore);
      savedSnapshotRef.current = loaded;
      // Only OCB activity that's actually saved should block the course's
      // has_certificate checkbox (OCA + PDF certs are allowed to coexist) —
      // reporting the live/draft value here would let an unsaved toggle flip
      // block the other tab before anything was really persisted.
      onActiveChange?.(kind === "ocb" && loaded.isActive);
      // Load issuance count to determine if identifierPrefix can be edited
      const count = await countIssuancesForTemplate(row.id).catch(() => 0);
      setIssuanceCount(count);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [courseId, courseSlug, t, onActiveChange]);

  useEffect(() => {
    void load();
  }, [load]);

  // The real toggle takes over from here — drop the "peek" so it doesn't
  // linger and force the card to stay expanded after a later off-toggle.
  useEffect(() => {
    if (isActive) setPeekExpanded(false);
  }, [isActive]);

  // The OCA image lives in the parent course form because it is uploaded to
  // course storage first, but it is only copied into the credential template
  // when this form is saved. Compare its current URL to the saved template
  // image so an upload/clear cannot be mistaken for a clean OCC form.
  const currentImageUrl = credentialKind === "oca"
    ? (onchainCertificateTemplateUrl?.trim() || imageUrl.trim())
    : imageUrl.trim();

  // True whenever any field differs from what's actually saved in the DB —
  // drives both the Save button's visual state and the parent's
  // "leave without saving" warning when switching away from this tab.
  const snap = savedSnapshotRef.current;
  const isDirty = snap
    ? isActive !== snap.isActive ||
      credentialKind !== snap.credentialKind ||
      name !== snap.name ||
      description !== snap.description ||
      currentImageUrl !== snap.imageUrl ||
      identifierPrefix !== snap.identifierPrefix ||
      completionPct !== snap.completionPct ||
      requireAssignmentPass !== snap.requireAssignmentPass ||
      minAssignmentScore !== snap.minAssignmentScore
    : false;

  useEffect(() => {
    // Deactivation is persisted immediately. While that write is in flight the
    // draft differs from the saved snapshot, but it is not a user draft that
    // should block navigation with a leave-without-saving warning.
    onDirtyChange?.(isDirty && !isDeactivating);
  }, [isDeactivating, isDirty, onDirtyChange]);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    if (!canEdit) {
      toast.error(t("courseEdit.ocb.noPermission"));
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadCourseCredentialBadgeImage(courseId, file);
      setImageUrl(url);
      toast.success(t("courseEdit.ocb.uploadOk"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const onFileSelect = async (file: File | null) => {
    if (!file) return;
    if (!canEdit) {
      toast.error(t("courseEdit.ocb.noPermission"));
      return;
    }

    const isPng = await validatePngSignature(file);
    if (!isPng) {
      toast.error(<InvalidPngToast />);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    await handleUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onchainFileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingOnchain, setUploadingOnchain] = useState(false);

  const handleUploadOnchain = async (file: File | null) => {
    if (!file) return;
    if (!canEdit) {
      toast.error(t("courseEdit.ocb.noPermission"));
      return;
    }
    setUploadingOnchain(true);
    try {
      const result = await uploadOnchainCertificateTemplate(
        courseId,
        file,
        onchainCertificateTemplatePath,
      );
      onOnchainCertificateUploaded?.(result);
      toast.success(t("courseEdit.ocb.onchainCertUploaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.onchainCertUploadFailed"));
    } finally {
      setUploadingOnchain(false);
    }
  };

  const onOnchainFileSelect = async (file: File | null) => {
    if (!file) return;
    if (!canEdit) {
      toast.error(t("courseEdit.ocb.noPermission"));
      return;
    }

    const isPng = await validatePngSignature(file);
    if (!isPng) {
      toast.error(<InvalidPngToast />);
      if (onchainFileRef.current) onchainFileRef.current.value = "";
      return;
    }

    await handleUploadOnchain(file);
    if (onchainFileRef.current) onchainFileRef.current.value = "";
  };

  /** The only path that persists OCA/OCB config. Accepts an explicit `active`
   *  override so the toggle-OFF auto-save path can pass the new value before
   *  React has flushed the state update. Defaults to the current `isActive`
   *  state for the manual Save button path. Returns whether the save went
   *  through, so callers can roll back optimistic UI on failure. */
  const handleSave = async (active = isActive): Promise<boolean> => {
    if (!canEdit) {
      toast.error(t("courseEdit.ocb.noPermission"));
      return false;
    }

    if (credentialKind === "ocb" && active && hasCertificate) {
      toast.error(t("courseEdit.ocb.blockedByCertificate"));
      return false;
    }

    if (active && credentialKind === "oca" && (!onchainCertificateTemplateUrl || !onchainCertificateTemplateUrl.trim())) {
      toast.error(t("courseEdit.ocb.onchainCertRequired"));
      return false;
    }

    // Turning off a credential that real learners already hold doesn't
    // revoke anything already minted (on-chain issuance is immutable) — it
    // only stops *future* learners from getting it. Confirm rather than
    // silently changing that policy out from under in-progress students.
    if (!active && issuanceCount > 0) {
      const proceed = window.confirm(
        t("courseEdit.ocb.confirmDeactivateWithIssuances", {
          count: issuanceCount,
          defaultValue: `Đã có ${issuanceCount} học viên nhận credential này. Tắt sẽ ngừng cấp cho học viên mới, KHÔNG thu hồi credential đã cấp cho học viên cũ. Tiếp tục tắt?`,
        }),
      );
      if (!proceed) return false;
    }

    // Optimistically report the state that is being persisted. This closes
    // the window where the parent Info tab could enable PDF certificates while
    // an OCB activation/deactivation request is still in flight. On failure,
    // restore the last known persisted OCB state below.
    const savedOcbIsActive =
      savedSnapshotRef.current?.credentialKind === "ocb" &&
      savedSnapshotRef.current.isActive;
    onActiveChange?.(savedOcbIsActive || (credentialKind === "ocb" && active));

    setSaving(true);
    try {
      const triggerRule: CourseCredentialTriggerRule = {
        completion_pct: Math.min(100, Math.max(0, completionPct)),
        require_assignment_pass: requireAssignmentPass,
        min_assignment_score: Math.min(100, Math.max(0, minAssignmentScore)),
      };

      // OCA mints on-chain using the dedicated name-free onchain template, not the
      // off-chain `certificateTemplateUrl` (which is meant to get the learner's name
      // stamped on it and must never be pushed on-chain).
      const finalImageUrl = credentialKind === "oca"
        ? (onchainCertificateTemplateUrl?.trim() || imageUrl.trim())
        : imageUrl.trim();

      if (active && !finalImageUrl) {
        toast.error(t("courseEdit.ocb.imageRequired"));
        return false;
      }

      const { id } = await saveCourseCredentialTemplate({
        courseId,
        courseSlug,
        templateId,
        isActive: active,
        name: name.trim() || courseSlug,
        description: description.trim() || name.trim() || courseSlug,
        imageUrl: finalImageUrl,
        identifierPrefix: identifierPrefix.trim(),
        triggerRule,
        credentialKind,
      });
      setTemplateId(id);
      toast.success(t("courseEdit.ocb.saved"));
      await load();
      return true;
    } catch (e) {
      onActiveChange?.(savedOcbIsActive);
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Toggling OFF saves immediately — no need to hit the Save button for a
  // simple deactivation. If the save fails or the user cancels the confirm,
  // roll the toggle back to ON so UI and DB stay in sync.
  const handleToggleChange = async (value: boolean) => {
    setIsActive(value);
    if (!value) {
      setIsDeactivating(true);
      const saved = await handleSave(false);
      setIsDeactivating(false);
      if (!saved) setIsActive(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground-muted py-4">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("courseEdit.ocb.loading")}
      </div>
    );
  }

  const isOcbBlockedByHasCert = credentialKind === "ocb" && hasCertificate;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Shield className="size-4 shrink-0 text-primary" aria-hidden />
            {t("courseEdit.ocb.title")}
          </h3>
          <p className="mt-1 text-sm text-foreground-muted">{t("courseEdit.ocb.subtitle")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <SectionToggle
            checked={isActive}
            disabled={!canEdit || saving}
            onChange={handleToggleChange}
            label={t("courseEdit.ocb.mintToggleLabel")}
          />
          <StatusBadge active={isActive} />
        </div>
      </div>

      {/* Collapsible body — the master switch above both enables on-chain minting
          and reveals its setup fields; turning it off disallows minting for this course.
          `peekExpanded` additionally reveals it (view-only, no persistence) when the
          Save button is clicked on a never-configured template. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          isActive || peekExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!isActive && !peekExpanded}
      >
        <div className="space-y-6 overflow-hidden">
          {/* Credential type */}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">{t("courseEdit.ocb.kind.label")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {KIND_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                credentialKind === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border-subtle bg-surface-raised hover:border-border"
              } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="credentialKind"
                value={opt.value}
                checked={credentialKind === opt.value}
                disabled={!canEdit}
                onChange={() => setCredentialKind(opt.value)}
                className="mt-0.5 accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{t(opt.labelKey as never)}</p>
                <p className="mt-0.5 text-xs text-foreground-muted">{t(opt.descKey as never)}</p>
              </div>
            </label>
          ))}
        </div>
        {isOcbBlockedByHasCert && (
          <div className="mt-2 flex items-center justify-between rounded-xl border border-border-subtle bg-surface-raised px-4 py-3">
            <p className="text-sm text-foreground-muted">
              {t("courseEdit.ocb.blockedByCertificate")}
            </p>
            {onClearLegacyCertificate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearLegacyCertificate}
              >
                {t("courseEdit.ocb.cancelCertificateButton", { defaultValue: "Hủy Chứng nhận" })}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Config fields — always visible */}
      <div className="space-y-4 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          {t("courseEdit.ocb.configTitle")}
        </p>

        <Field>
          <FieldLabel>{t("courseEdit.ocb.nameLabel")}</FieldLabel>
          <Input value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field>
          <FieldLabel>{t("courseEdit.ocb.descriptionLabel")}</FieldLabel>
          <textarea
            value={description}
            disabled={!canEdit}
            rows={3}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            className="min-h-[88px] w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:opacity-60"
          />
        </Field>

        <Field>
          <FieldLabel>
            {credentialKind === "oca"
              ? t("courseEdit.ocb.onchainCertLabel")
              : t("courseEdit.ocb.badgeImageLabel")}
          </FieldLabel>
          {credentialKind === "oca" ? (
            <>

              <input
                ref={onchainFileRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(e) => void onOnchainFileSelect(e.target.files?.[0] ?? null)}
              />
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canEdit || uploadingOnchain}
                  onClick={() => onchainFileRef.current?.click()}
                >
                  {uploadingOnchain ? t("courseEdit.ocb.uploading") : t("courseEdit.ocb.uploadOnchainCert")}
                </Button>
                {onchainCertificateTemplateUrl && (
                  <div className="relative size-14 shrink-0 rounded border border-border-subtle bg-surface-raised">
                    <img src={onchainCertificateTemplateUrl} alt="" className="size-full rounded object-cover" />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onClearOnchainCertificate?.()}
                        className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <span className="text-[10px] font-bold">×</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-xs text-foreground-muted">{t("courseEdit.ocb.onchainCertHint")}</p>
            </>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(e) => void onFileSelect(e.target.files?.[0] ?? null)}
              />
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canEdit || uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? t("courseEdit.ocb.uploading") : t("courseEdit.ocb.uploadBadge")}
                </Button>
                {imageUrl && (
                  <div className="relative size-14 shrink-0 rounded border border-border-subtle bg-surface-raised">
                    <img src={imageUrl} alt="" className="size-full rounded object-cover" />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <span className="text-[10px] font-bold">×</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-xs text-foreground-muted">{t("courseEdit.ocb.imageHint")}</p>
            </>
          )}
        </Field>

        <Field>
          <FieldLabel>{t("courseEdit.ocb.identifierPrefixLabel")}</FieldLabel>
          <div className="relative">
            <Input
              value={identifierPrefix}
              disabled={!canEdit || issuanceCount > 0}
              onChange={(e) => setIdentifierPrefix(e.target.value.slice(0, 40))}
              placeholder={`corelia:${courseSlug}`}
              className={issuanceCount > 0 ? "pr-8" : ""}
            />
            {issuanceCount > 0 && (
              <LockKeyhole
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground-muted"
                aria-hidden
              />
            )}
          </div>
          {issuanceCount > 0 ? (
            <p className="mt-1 text-xs text-warning">
              Đã có {issuanceCount} credential được tạo. Tiền tố đã bị khoá để tránh mint trùng.
            </p>
          ) : (
            <p className="mt-1 text-xs text-foreground-muted">{t("courseEdit.ocb.identifierHint")}</p>
          )}
        </Field>
      </div>

      {/* Requirements */}
      <div className="space-y-4 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          {t("courseEdit.ocb.requirementsTitle")}
        </p>

        <Field>
          <FieldLabel>{t("courseEdit.ocb.completionPctLabel")}</FieldLabel>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              max={100}
              disabled={!canEdit}
              value={completionPct}
              onChange={(e) => setCompletionPct(Number(e.target.value))}
              className="w-28"
            />
            <span className="text-sm text-foreground-muted">%</span>
          </div>
        </Field>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requireAssignmentPass}
            disabled={!canEdit}
            onChange={(e) => setRequireAssignmentPass(e.target.checked)}
            className="size-4 accent-primary rounded border-border"
          />
          <span>{t("courseEdit.ocb.requireAssignmentLabel")}</span>
        </label>

        {requireAssignmentPass && (
          <Field>
            <FieldLabel>{t("courseEdit.ocb.minScoreLabel")}</FieldLabel>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                disabled={!canEdit}
                value={minAssignmentScore}
                onChange={(e) => setMinAssignmentScore(Number(e.target.value))}
                className="w-28"
              />
              <span className="text-sm text-foreground-muted">/ 100</span>
            </div>
          </Field>
        )}
      </div>
        </div>
      </div>

      {/* Outside the collapsible body on purpose — must stay reachable even
          while the master switch above is off, otherwise there'd be no way
          to save other field edits (or re-enable) without expanding first.
          Outline + blue-on-hover while there are unsaved edits; solid blue
          once everything is actually persisted. */}
      <Button
        type="button"
        variant={isDirty ? "outline" : "default"}
        className={isDirty ? "hover:!border-primary hover:!bg-primary hover:!text-primary-foreground" : ""}
        disabled={!canEdit || saving || isOcbBlockedByHasCert}
        onClick={() => {
          // Never-configured + collapsed: nothing valid to save yet (no
          // image/template picked), so reveal the fields instead of firing
          // a confusing validation error on a form the user hasn't seen.
          if (!isActive && !templateId) {
            setPeekExpanded(true);
            return;
          }
          void handleSave();
        }}
      >
        {saving ? t("courseEdit.ocb.saving") : t("courseEdit.ocb.save")}
      </Button>
    </div>
  );
}
