import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { validatePngSignature } from "@/lib/imageValidation";
import { uploadActivityMilestoneBadgeImage } from "@/lib/storage";
import {
  saveActivityMilestoneTemplate,
  type CourseCredentialKind,
} from "@/lib/credentialTemplates";
import { cn } from "@/lib/utils";

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-foreground">{children}</label>;
}

const TEXTAREA_CLASS =
  "w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

interface ManualMintCreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function ManualMintCreateTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: ManualMintCreateTemplateDialogProps) {
  const { t } = useTranslation("admin");
  const [credentialKind, setCredentialKind] = useState<CourseCredentialKind>("ocb");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setImageUrl("");
    setDescription("");
    setCredentialKind("ocb");
    setUploadingImage(false);
    setSaving(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const onFileSelect = async (file: File | null) => {
    if (!file) return;
    const isPng = await validatePngSignature(file);
    if (!isPng) {
      toast.error(
        <span>
          {t("manualMint.form.invalidPng")}{" "}
          <a
            href="https://www.remove.bg"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold text-primary-foreground hover:opacity-85"
          >
            remove.bg
          </a>
        </span>,
      );
      return;
    }
    setUploadingImage(true);
    try {
      const { url } = await uploadActivityMilestoneBadgeImage(file);
      setImageUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("manualMint.form.uploadFailed"));
    } finally {
      setUploadingImage(false);
    }
  };

  const canSave = name.trim() !== "" && imageUrl.trim() !== "" && !uploadingImage && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await saveActivityMilestoneTemplate({
        templateId: null,
        isActive: true,
        name: name.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        identifierPrefix: `corelia:manual-template-${Date.now()}`.slice(0, 40),
        triggerType: "manual",
        triggerRule: { manual: true, saved_as_template: true },
        credentialKind,
      });

      toast.success(t("manualMint.templates.createSuccess"));
      handleClose(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("manualMint.templates.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("manualMint.templates.createDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("manualMint.templates.createDialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Kind Toggle (OCA vs OCB) */}
          <Field>
            <FieldLabel>{t("manualMint.form.kind")}</FieldLabel>
            <div className="flex overflow-hidden rounded-md border border-border-subtle">
              <button
                type="button"
                onClick={() => setCredentialKind("oca")}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium transition-colors",
                  credentialKind === "oca"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-surface-base text-foreground-muted hover:bg-surface-raised",
                )}
              >
                OCA (Certificate)
              </button>
              <button
                type="button"
                onClick={() => setCredentialKind("ocb")}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium transition-colors",
                  credentialKind === "ocb"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-surface-base text-foreground-muted hover:bg-surface-raised",
                )}
              >
                OCB (Badge)
              </button>
            </div>
          </Field>

          {/* Template Name */}
          <Field>
            <FieldLabel>{t("manualMint.form.name")}</FieldLabel>
            <Input
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder={t("manualMint.templates.templateNamePlaceholder")}
            />
          </Field>

          {/* Template Image Upload */}
          <Field>
            <FieldLabel>{t("manualMint.form.image")}</FieldLabel>
            <div className="relative flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border-subtle bg-surface-base p-5 text-center transition-colors hover:bg-surface-raised">
              <input
                type="file"
                accept="image/png"
                disabled={uploadingImage}
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  void onFileSelect(e.target.files?.[0] ?? null);
                }}
              />
              <div className="flex flex-col items-center gap-1.5 text-xs text-foreground-muted">
                {uploadingImage ? (
                  <>
                    <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
                    <span className="font-medium text-primary">{t("manualMint.form.uploading")}</span>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-surface-raised p-2.5">
                      <Upload className="size-4" aria-hidden />
                    </div>
                    <span className="font-medium text-primary">{t("manualMint.form.uploadCta")}</span>
                  </>
                )}
              </div>
            </div>
            {imageUrl ? (
              <div className="mt-2.5 overflow-hidden rounded-md border border-border-subtle bg-surface-raised p-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground-muted">
                  <ImageIcon className="size-3.5" />
                  {t("manualMint.form.imagePreview")}
                </div>
                <img src={imageUrl} alt="" className="h-28 w-full object-contain" />
              </div>
            ) : null}
          </Field>

          {/* Description */}
          <Field>
            <FieldLabel>{t("manualMint.form.reason")}</FieldLabel>
            <textarea
              rows={3}
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder={t("manualMint.templates.templateDescriptionPlaceholder")}
              className={TEXTAREA_CLASS}
            />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={saving}
          >
            {t("common:actions.cancel", { defaultValue: "Hủy" })}
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                {t("common:actions.saving", { defaultValue: "Đang lưu…" })}
              </>
            ) : (
              t("manualMint.templates.saveTemplateBtn")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
