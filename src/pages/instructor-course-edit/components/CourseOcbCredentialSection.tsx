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
import { uploadCourseCredentialBadgeImage } from "@/lib/storage";
import { toast } from "sonner";
import { validatePngSignature, checkImageDimensions } from "@/lib/imageValidation";
import { CanvasCropperModal } from "@/components/ui/CanvasCropperModal";

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
  certificateTemplateUrl,
  onClearLegacyCertificate,
}: {
  courseId: string;
  courseSlug: string;
  canEdit: boolean;
  hasCertificate?: boolean;
  onActiveChange?: (active: boolean) => void;
  certificateTemplateUrl?: string | null;
  onClearLegacyCertificate?: () => void;
}) {
  const { t } = useTranslation("instructor");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [credentialKind, setCredentialKind] = useState<CourseCredentialKind>("oca");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [identifierPrefix, setIdentifierPrefix] = useState("");
  const [issuanceCount, setIssuanceCount] = useState(0);
  const [completionPct, setCompletionPct] = useState(100);
  const [requireAssignmentPass, setRequireAssignmentPass] = useState(false);
  const [minAssignmentScore, setMinAssignmentScore] = useState(70);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getLatestCourseCredentialTemplate(courseId);
      if (!row) {
        setTemplateId(null);
        setIsActive(true);
        onActiveChange?.(true);
        setCredentialKind("oca");
        setName("");
        setDescription("");
        setImageUrl("");
        setIdentifierPrefix(`corelia:${courseSlug}`.slice(0, 40));
        setCompletionPct(100);
        setRequireAssignmentPass(false);
        setMinAssignmentScore(70);
        setIssuanceCount(0);
        return;
      }
      setTemplateId(row.id);
      setIsActive(row.is_active);
      onActiveChange?.(row.is_active);
      setCredentialKind(row.collection_symbol ? "ocb" : "oca");
      setName(row.name ?? "");
      setDescription(row.description ?? "");
      setImageUrl(row.image_url ?? "");
      setIdentifierPrefix(row.identifier_prefix ?? "");
      const tr = row.trigger_rule as CourseCredentialTriggerRule | null;
      setCompletionPct(Number(tr?.completion_pct ?? 100));
      setRequireAssignmentPass(tr?.require_assignment_pass === true);
      setMinAssignmentScore(Number(tr?.min_assignment_score ?? 70));
      // Load issuance count to determine if identifierPrefix can be edited
      const count = await countIssuancesForTemplate(row.id).catch(() => 0);
      setIssuanceCount(count);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [courseId, courseSlug, onActiveChange, t]);

  useEffect(() => {
    void load();
  }, [load]);

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
      toast.error(
        <span>
          Định dạng file không phải PNG. Vui lòng tách nền hoặc chuyển đổi ảnh tại{" "}
          <a href="https://www.remove.bg" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-primary-foreground hover:opacity-85">
            remove.bg
          </a>
        </span>
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    try {
      const { isSquare } = await checkImageDimensions(file);
      if (isSquare) {
        await handleUpload(file);
      } else {
        setPendingFile(file);
        setCropperOpen(true);
      }
    } catch {
      toast.error(t("courseEdit.ocb.invalidImage", { defaultValue: "Không thể đọc tệp hình ảnh." }));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCroppedUpload = async (croppedFile: File) => {
    setCropperOpen(false);
    setPendingFile(null);
    await handleUpload(croppedFile);
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast.error(t("courseEdit.ocb.noPermission"));
      return;
    }

    if (credentialKind === "oca" && (!certificateTemplateUrl || !certificateTemplateUrl.trim())) {
      toast.error("Vui lòng tải lên ảnh template chứng chỉ khi bật cấu hình Open Campus (OCA).");
      return;
    }
    setSaving(true);
    try {
      const triggerRule: CourseCredentialTriggerRule = {
        completion_pct: Math.min(100, Math.max(0, completionPct)),
        require_assignment_pass: requireAssignmentPass,
        min_assignment_score: Math.min(100, Math.max(0, minAssignmentScore)),
      };

      // [TC-03 FIX] OCA must use the course certificate template - no imageUrl fallback
      const finalImageUrl = credentialKind === "oca"
        ? certificateTemplateUrl!.trim()
        : imageUrl.trim();

      if (!finalImageUrl) {
        toast.error("Vui lòng tải lên hình ảnh cho chứng chỉ/huy hiệu trước khi lưu.");
        setSaving(false);
        return;
      }

      const { id } = await saveCourseCredentialTemplate({
        courseId,
        courseSlug,
        templateId,
        isActive: true, // ALWAYS make the saved template the active one for this course
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.ocb.saveFailed"));
    } finally {
      setSaving(false);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Shield className="size-4 text-primary" aria-hidden />
            {t("courseEdit.ocb.title")}
          </h3>
          <p className="mt-1 text-sm text-foreground-muted">{t("courseEdit.ocb.subtitle")}</p>
        </div>
        <StatusBadge active={isActive} />
      </div>

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
                onChange={() => {
                  setCredentialKind(opt.value);
                  if (opt.value === "oca") {
                    setIsActive(true);
                    onActiveChange?.(true);
                  }
                }}
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
          <div className="mt-2 flex items-center justify-between bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
            <p className="text-xs text-warning-foreground">
              {t("courseEdit.ocb.blockedByCertificate")}
            </p>
            {onClearLegacyCertificate && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onClearLegacyCertificate}
              >
                Hủy OCA
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Enable toggle — OCB only (OCB is auto-minted; OCA is always claimable once saved) */}
      {credentialKind === "ocb" && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
          <input
            type="checkbox"
            checked={isActive}
            disabled={!canEdit || isOcbBlockedByHasCert}
            onChange={(e) => {
              setIsActive(e.target.checked);
              onActiveChange?.(e.target.checked);
            }}
            className="size-4 accent-primary rounded border-border"
          />
          <div>
            <p className="text-sm font-medium text-foreground">{t("courseEdit.ocb.enableLabel")}</p>
            <p className="text-xs text-foreground-muted">{t("courseEdit.ocb.enableHint")}</p>
          </div>
        </label>
      )}

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
          <FieldLabel>{t("courseEdit.ocb.imageLabel")}</FieldLabel>
          {credentialKind === "oca" ? (
            <div className="mt-1 flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-base p-3">
              {certificateTemplateUrl ? (
                <img
                  src={certificateTemplateUrl}
                  alt=""
                  className="h-16 w-auto rounded border border-border-subtle shrink-0"
                />
              ) : (
                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded border border-dashed border-border-subtle bg-surface-raised text-xs text-foreground-muted">
                  {t("courseEdit.ocb.imageOcaNoTemplate")}
                </div>
              )}
              <p className="text-xs text-foreground-muted leading-relaxed">
                {t("courseEdit.ocb.imageOcaHint")}
              </p>
            </div>
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

      <Button type="button" disabled={!canEdit || saving || isOcbBlockedByHasCert} onClick={() => void handleSave()}>
        {saving ? t("courseEdit.ocb.saving") : t("courseEdit.ocb.save")}
      </Button>

      <CanvasCropperModal
        open={cropperOpen}
        imageFile={pendingFile}
        onCrop={(cropped) => void handleCroppedUpload(cropped)}
        onCancel={() => {
          setCropperOpen(false);
          setPendingFile(null);
        }}
      />
    </div>
  );
}
