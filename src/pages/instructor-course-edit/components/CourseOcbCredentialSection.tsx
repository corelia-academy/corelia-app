import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, LockKeyhole, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  countIssuancesForTemplate,
  listCourseCredentialTemplates,
  saveCourseCredentialTemplate,
  type CredentialTemplateRow,
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
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-5 rounded-full bg-primary-foreground shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/** Requirements fields shared by both the OCA and OCB cards (same shape, kept
 *  inline per card since each card owns its own independent state/save flow). */
function RequirementsFields({
  canEdit,
  completionPct,
  setCompletionPct,
  requireAssignmentPass,
  setRequireAssignmentPass,
  minAssignmentScore,
  setMinAssignmentScore,
}: {
  canEdit: boolean;
  completionPct: number;
  setCompletionPct: (v: number) => void;
  requireAssignmentPass: boolean;
  setRequireAssignmentPass: (v: boolean) => void;
  minAssignmentScore: number;
  setMinAssignmentScore: (v: number) => void;
}) {
  const { t } = useTranslation("instructor");
  return (
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
  );
}

function IdentifierPrefixField({
  canEdit,
  identifierPrefix,
  setIdentifierPrefix,
  courseSlug,
  issuanceCount,
}: {
  canEdit: boolean;
  identifierPrefix: string;
  setIdentifierPrefix: (v: string) => void;
  courseSlug: string;
  issuanceCount: number;
}) {
  const { t } = useTranslation("instructor");
  return (
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
  );
}

type OcaCardProps = {
  courseId: string;
  courseSlug: string;
  canEdit: boolean;
  row: CredentialTemplateRow | null;
  onSaved: () => void;
  onchainCertificateTemplateUrl?: string | null;
  onchainCertificateTemplatePath?: string | null;
  onOnchainCertificateUploaded?: (result: { url: string; path: string }) => void;
  onClearOnchainCertificate?: () => void;
};

/** OCA has no active/inactive toggle — a saved template is always claimable
 *  (learner-initiated, never auto-minted), matching the existing "OCA is
 *  always claimable once saved" behavior. */
function OcaCredentialCard({
  courseId,
  courseSlug,
  canEdit,
  row,
  onSaved,
  onchainCertificateTemplateUrl,
  onchainCertificateTemplatePath,
  onOnchainCertificateUploaded,
  onClearOnchainCertificate,
}: OcaCardProps) {
  const { t } = useTranslation("instructor");
  const onchainFileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingOnchain, setUploadingOnchain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issuanceCount, setIssuanceCount] = useState(0);

  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [identifierPrefix, setIdentifierPrefix] = useState(
    row?.identifier_prefix ?? `corelia:${courseSlug}`.slice(0, 40),
  );
  const rule = (row?.trigger_rule as CourseCredentialTriggerRule | null) ?? null;
  const [completionPct, setCompletionPct] = useState(Number(rule?.completion_pct ?? 100));
  const [requireAssignmentPass, setRequireAssignmentPass] = useState(rule?.require_assignment_pass === true);
  const [minAssignmentScore, setMinAssignmentScore] = useState(Number(rule?.min_assignment_score ?? 70));

  useEffect(() => {
    setName(row?.name ?? "");
    setDescription(row?.description ?? "");
    setIdentifierPrefix(row?.identifier_prefix || `corelia:${courseSlug}`.slice(0, 40));
    const r = (row?.trigger_rule as CourseCredentialTriggerRule | null) ?? null;
    setCompletionPct(Number(r?.completion_pct ?? 100));
    setRequireAssignmentPass(r?.require_assignment_pass === true);
    setMinAssignmentScore(Number(r?.min_assignment_score ?? 70));
    if (row?.id) {
      countIssuancesForTemplate(row.id).then(setIssuanceCount).catch(() => setIssuanceCount(0));
    } else {
      setIssuanceCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const handleUploadOnchain = async (file: File | null) => {
    if (!file) return;
    if (!canEdit) {
      toast.error(t("courseEdit.ocb.noPermission"));
      return;
    }
    setUploadingOnchain(true);
    try {
      const result = await uploadOnchainCertificateTemplate(courseId, file, onchainCertificateTemplatePath);
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

  const handleSave = async () => {
    if (!canEdit) {
      toast.error(t("courseEdit.ocb.noPermission"));
      return;
    }
    if (!onchainCertificateTemplateUrl || !onchainCertificateTemplateUrl.trim()) {
      toast.error(t("courseEdit.ocb.onchainCertRequired"));
      return;
    }
    setSaving(true);
    try {
      const triggerRule: CourseCredentialTriggerRule = {
        completion_pct: Math.min(100, Math.max(0, completionPct)),
        require_assignment_pass: requireAssignmentPass,
        min_assignment_score: Math.min(100, Math.max(0, minAssignmentScore)),
      };
      await saveCourseCredentialTemplate({
        courseId,
        courseSlug,
        templateId: row?.id ?? null,
        isActive: true,
        name: name.trim() || courseSlug,
        description: description.trim() || name.trim() || courseSlug,
        imageUrl: onchainCertificateTemplateUrl.trim(),
        identifierPrefix: identifierPrefix.trim(),
        triggerRule,
        credentialKind: "oca",
      });
      toast.success(t("courseEdit.ocb.saved"));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Shield className="size-4 text-primary" aria-hidden />
            {t("courseEdit.ocb.kind.oca.label")}
          </h3>
          <p className="mt-1 text-sm text-foreground-muted">{t("courseEdit.ocb.kind.oca.desc")}</p>
        </div>
        <StatusBadge active={Boolean(row?.id)} />
      </div>

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
          <FieldLabel>{t("courseEdit.ocb.onchainCertLabel")}</FieldLabel>
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
        </Field>

        <IdentifierPrefixField
          canEdit={canEdit}
          identifierPrefix={identifierPrefix}
          setIdentifierPrefix={setIdentifierPrefix}
          courseSlug={courseSlug}
          issuanceCount={issuanceCount}
        />
      </div>

      <RequirementsFields
        canEdit={canEdit}
        completionPct={completionPct}
        setCompletionPct={setCompletionPct}
        requireAssignmentPass={requireAssignmentPass}
        setRequireAssignmentPass={setRequireAssignmentPass}
        minAssignmentScore={minAssignmentScore}
        setMinAssignmentScore={setMinAssignmentScore}
      />

      <Button type="button" disabled={!canEdit || saving} onClick={() => void handleSave()}>
        {saving ? t("courseEdit.ocb.saving") : t("courseEdit.ocb.save")}
      </Button>
    </section>
  );
}

type OcbCardProps = {
  courseId: string;
  courseSlug: string;
  canEdit: boolean;
  row: CredentialTemplateRow | null;
  hasCertificate: boolean;
  onSaved: () => void;
  onActiveChange?: (active: boolean) => void;
  onClearLegacyCertificate?: () => void;
};

function OcbCredentialCard({
  courseId,
  courseSlug,
  canEdit,
  row,
  hasCertificate,
  onSaved,
  onActiveChange,
  onClearLegacyCertificate,
}: OcbCardProps) {
  const { t } = useTranslation("instructor");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issuanceCount, setIssuanceCount] = useState(0);

  const [isActive, setIsActive] = useState(row?.is_active ?? false);
  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [imageUrl, setImageUrl] = useState(row?.image_url ?? "");
  const [identifierPrefix, setIdentifierPrefix] = useState(
    row?.identifier_prefix ?? `corelia:${courseSlug}`.slice(0, 40),
  );
  const rule = (row?.trigger_rule as CourseCredentialTriggerRule | null) ?? null;
  const [completionPct, setCompletionPct] = useState(Number(rule?.completion_pct ?? 100));
  const [requireAssignmentPass, setRequireAssignmentPass] = useState(rule?.require_assignment_pass === true);
  const [minAssignmentScore, setMinAssignmentScore] = useState(Number(rule?.min_assignment_score ?? 70));

  useEffect(() => {
    const active = row?.is_active ?? false;
    setIsActive(active);
    onActiveChange?.(active);
    setName(row?.name ?? "");
    setDescription(row?.description ?? "");
    setImageUrl(row?.image_url ?? "");
    setIdentifierPrefix(row?.identifier_prefix || `corelia:${courseSlug}`.slice(0, 40));
    const r = (row?.trigger_rule as CourseCredentialTriggerRule | null) ?? null;
    setCompletionPct(Number(r?.completion_pct ?? 100));
    setRequireAssignmentPass(r?.require_assignment_pass === true);
    setMinAssignmentScore(Number(r?.min_assignment_score ?? 70));
    if (row?.id) {
      countIssuancesForTemplate(row.id).then(setIssuanceCount).catch(() => setIssuanceCount(0));
    } else {
      setIssuanceCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const isBlockedByHasCert = hasCertificate;

  const handleToggleActive = (value: boolean) => {
    setIsActive(value);
    onActiveChange?.(value);
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
    setUploading(true);
    try {
      const { url } = await uploadCourseCredentialBadgeImage(courseId, file);
      setImageUrl(url);
      toast.success(t("courseEdit.ocb.uploadOk"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast.error(t("courseEdit.ocb.noPermission"));
      return;
    }
    if (!imageUrl.trim()) {
      toast.error("Vui lòng tải lên hình ảnh cho huy hiệu trước khi lưu.");
      return;
    }
    setSaving(true);
    try {
      const triggerRule: CourseCredentialTriggerRule = {
        completion_pct: Math.min(100, Math.max(0, completionPct)),
        require_assignment_pass: requireAssignmentPass,
        min_assignment_score: Math.min(100, Math.max(0, minAssignmentScore)),
      };
      await saveCourseCredentialTemplate({
        courseId,
        courseSlug,
        templateId: row?.id ?? null,
        isActive: isActive && !isBlockedByHasCert,
        name: name.trim() || courseSlug,
        description: description.trim() || name.trim() || courseSlug,
        imageUrl: imageUrl.trim(),
        identifierPrefix: identifierPrefix.trim(),
        triggerRule,
        credentialKind: "ocb",
      });
      toast.success(t("courseEdit.ocb.saved"));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Shield className="size-4 text-primary" aria-hidden />
            {t("courseEdit.ocb.kind.ocb.label")}
          </h3>
          <p className="mt-1 text-sm text-foreground-muted">{t("courseEdit.ocb.kind.ocb.desc")}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge active={isActive && !isBlockedByHasCert} />
          <SectionToggle
            checked={isActive}
            disabled={!canEdit || isBlockedByHasCert}
            onChange={handleToggleActive}
            label={t("courseEdit.ocb.enableLabel")}
          />
        </div>
      </div>

      {isBlockedByHasCert && (
        <div className="flex items-center justify-between bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
          <p className="text-xs text-warning-foreground">{t("courseEdit.ocb.blockedByCertificate")}</p>
          {onClearLegacyCertificate && (
            <Button type="button" variant="destructive" size="sm" onClick={onClearLegacyCertificate}>
              {t("courseEdit.ocb.disablePdfCertificate")}
            </Button>
          )}
        </div>
      )}

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
          <FieldLabel>{t("courseEdit.ocb.imageLabel")}</FieldLabel>
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
        </Field>

        <IdentifierPrefixField
          canEdit={canEdit}
          identifierPrefix={identifierPrefix}
          setIdentifierPrefix={setIdentifierPrefix}
          courseSlug={courseSlug}
          issuanceCount={issuanceCount}
        />
      </div>

      <RequirementsFields
        canEdit={canEdit}
        completionPct={completionPct}
        setCompletionPct={setCompletionPct}
        requireAssignmentPass={requireAssignmentPass}
        setRequireAssignmentPass={setRequireAssignmentPass}
        minAssignmentScore={minAssignmentScore}
        setMinAssignmentScore={setMinAssignmentScore}
      />

      <Button type="button" disabled={!canEdit || saving || isBlockedByHasCert} onClick={() => void handleSave()}>
        {saving ? t("courseEdit.ocb.saving") : t("courseEdit.ocb.save")}
      </Button>
    </section>
  );
}

export function CourseOcbCredentialSection({
  courseId,
  courseSlug,
  canEdit,
  hasCertificate = false,
  onActiveChange,
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
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<CredentialTemplateRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listCourseCredentialTemplates(courseId);
      setTemplates(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [courseId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground-muted py-4">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("courseEdit.ocb.loading")}
      </div>
    );
  }

  const ocaRow = templates.find((r) => !r.collection_symbol) ?? null;
  const ocbRow = templates.find((r) => Boolean(r.collection_symbol)) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-foreground">{t("courseEdit.ocb.title")}</h2>
        <p className="mt-1 text-sm text-foreground-muted">{t("courseEdit.ocb.subtitle")}</p>
      </div>

      <OcaCredentialCard
        courseId={courseId}
        courseSlug={courseSlug}
        canEdit={canEdit}
        row={ocaRow}
        onSaved={() => void load()}
        onchainCertificateTemplateUrl={onchainCertificateTemplateUrl}
        onchainCertificateTemplatePath={onchainCertificateTemplatePath}
        onOnchainCertificateUploaded={onOnchainCertificateUploaded}
        onClearOnchainCertificate={onClearOnchainCertificate}
      />

      <OcbCredentialCard
        courseId={courseId}
        courseSlug={courseSlug}
        canEdit={canEdit}
        row={ocbRow}
        hasCertificate={hasCertificate}
        onSaved={() => void load()}
        onActiveChange={onActiveChange}
        onClearLegacyCertificate={onClearLegacyCertificate}
      />
    </div>
  );
}
