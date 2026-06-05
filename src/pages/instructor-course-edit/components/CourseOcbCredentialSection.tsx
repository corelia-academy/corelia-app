import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getLatestCourseCredentialTemplate,
  saveCourseCredentialTemplate,
  type CourseCredentialTriggerRule,
} from "@/lib/credentialTemplates";
import { uploadCourseCredentialBadgeImage } from "@/lib/storage";
import { toast } from "sonner";

export function CourseOcbCredentialSection({
  courseId,
  courseSlug,
  canEdit,
  hasCertificate = false,
  onActiveChange,
}: {
  courseId: string;
  courseSlug: string;
  canEdit: boolean;
  hasCertificate?: boolean;
  onActiveChange?: (active: boolean) => void;
}) {
  const { t } = useTranslation("instructor");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [identifierPrefix, setIdentifierPrefix] = useState("");
  const [completionPct, setCompletionPct] = useState(100);
  const [requireAssignmentPass, setRequireAssignmentPass] = useState(true);
  const [minAssignmentScore, setMinAssignmentScore] = useState(70);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getLatestCourseCredentialTemplate(courseId);
      if (!row) {
        setTemplateId(null);
        setIsActive(false);
        onActiveChange?.(false);
        setName("");
        setDescription("");
        setImageUrl("");
        setIdentifierPrefix(`corelia:${courseSlug}`.slice(0, 40));
        setCompletionPct(100);
        setRequireAssignmentPass(true);
        setMinAssignmentScore(70);
        return;
      }
      setTemplateId(row.id);
      setIsActive(row.is_active);
      onActiveChange?.(row.is_active);
      setName(row.name ?? "");
      setDescription(row.description ?? "");
      setImageUrl(row.image_url ?? "");
      setIdentifierPrefix(row.identifier_prefix ?? "");
      const tr = row.trigger_rule as CourseCredentialTriggerRule | null;
      setCompletionPct(Number(tr?.completion_pct ?? 100));
      setRequireAssignmentPass(tr?.require_assignment_pass !== false);
      setMinAssignmentScore(Number(tr?.min_assignment_score ?? 70));
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
      toast.error("Bạn không có quyền cấu hình Open Campus badge cho khoá học này.");
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

  const handleSave = async () => {
    if (!canEdit) {
      toast.error("Bạn không có quyền cấu hình Open Campus badge cho khoá học này.");
      return;
    }
    setSaving(true);
    try {
      const triggerRule: CourseCredentialTriggerRule = {
        completion_pct: Math.min(100, Math.max(0, completionPct)),
        require_assignment_pass: requireAssignmentPass,
        min_assignment_score: Math.min(100, Math.max(0, minAssignmentScore)),
      };
      const { id } = await saveCourseCredentialTemplate({
        courseId,
        courseSlug,
        templateId,
        isActive,
        name: name.trim() || courseSlug,
        description: description.trim() || name.trim() || courseSlug,
        imageUrl: imageUrl.trim(),
        identifierPrefix: identifierPrefix.trim(),
        triggerRule,
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
      <div className="flex items-center gap-2 text-sm text-foreground-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("courseEdit.ocb.loading")}
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-6 border-t border-border-subtle pt-8">
      <div>
        <h3 className="text-base font-medium text-foreground">{t("courseEdit.ocb.title")}</h3>
        <p className="mt-1 text-sm text-foreground-muted">{t("courseEdit.ocb.subtitle")}</p>
      </div>

      <label className={`flex cursor-pointer items-center gap-2 text-sm ${hasCertificate ? "opacity-50 cursor-not-allowed" : ""}`}>
        <input
          type="checkbox"
          checked={isActive}
          disabled={!canEdit || hasCertificate}
          onChange={(e) => {
            setIsActive(e.target.checked);
            onActiveChange?.(e.target.checked);
          }}
          className="size-4 rounded border-border"
        />
        <span>{t("courseEdit.ocb.enableLabel")}</span>
      </label>
      {hasCertificate && (
        <p className="text-xs text-foreground-muted">{t("courseEdit.ocb.blockedByCertificate")}</p>
      )}

      {isActive ? (
        <div className="space-y-4">
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
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)}
              className="min-h-[88px] w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:opacity-60"
            />
          </Field>
          <Field>
            <FieldLabel>{t("courseEdit.ocb.imageLabel")}</FieldLabel>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
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
              {imageUrl ? (
                <img src={imageUrl} alt="" className="h-14 w-auto rounded border border-border-subtle" />
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-foreground-muted">{t("courseEdit.ocb.imageHint")}</p>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("courseEdit.ocb.completionPctLabel")}</FieldLabel>
              <Input
                type="number"
                min={0}
                max={100}
                disabled={!canEdit}
                value={completionPct}
                onChange={(e) => setCompletionPct(Number(e.target.value))}
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requireAssignmentPass}
              disabled={!canEdit}
              onChange={(e) => setRequireAssignmentPass(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <span>{t("courseEdit.ocb.requireAssignmentLabel")}</span>
          </label>

          {requireAssignmentPass ? (
            <Field>
              <FieldLabel>{t("courseEdit.ocb.minScoreLabel")}</FieldLabel>
              <Input
                type="number"
                min={0}
                max={100}
                disabled={!canEdit}
                value={minAssignmentScore}
                onChange={(e) => setMinAssignmentScore(Number(e.target.value))}
              />
            </Field>
          ) : null}

          <Field>
            <FieldLabel>{t("courseEdit.ocb.identifierPrefixLabel")}</FieldLabel>
            <Input
              value={identifierPrefix}
              disabled={!canEdit}
              onChange={(e) => setIdentifierPrefix(e.target.value.slice(0, 40))}
              placeholder={`corelia:${courseSlug}`}
            />
            <p className="mt-1 text-xs text-foreground-muted">{t("courseEdit.ocb.identifierHint")}</p>
          </Field>

          <Button type="button" disabled={!canEdit || saving} onClick={() => void handleSave()}>
            {saving ? t("courseEdit.ocb.saving") : t("courseEdit.ocb.save")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
