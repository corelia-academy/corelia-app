import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { uploadCoreliaLogo } from "@/lib/storage";
import { getSystemSetting, setSystemSetting } from "@/lib/systemSettings";

const LOGO_KEY = "corelia_logo_url";

export default function AdminBranding() {
  const { t } = useTranslation("admin");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await getSystemSetting(LOGO_KEY);
      setLogoUrl(v ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("branding.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadCoreliaLogo(file);
      setLogoUrl(url);
      await setSystemSetting(LOGO_KEY, url);
      toast.success(t("branding.uploaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("branding.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveUrl = async () => {
    setSaving(true);
    try {
      await setSystemSetting(LOGO_KEY, logoUrl.trim());
      toast.success(t("branding.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("branding.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-foreground-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("branding.loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("branding.logo.title")}</h2>
        <p className="mt-1 text-sm text-foreground-muted">{t("branding.logo.subtitle")}</p>
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface-base p-4 sm:p-6">
        {/* Preview */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-raised">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-full object-contain" />
            ) : (
              <ImageIcon className="size-8 text-foreground-muted" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              {uploading ? t("branding.uploading") : t("branding.logo.uploadButton")}
            </Button>
            <p className="mt-1.5 text-xs text-foreground-muted">{t("branding.logo.hint")}</p>
          </div>
        </div>

        {/* URL field (manual override) */}
        <Field>
          <FieldLabel>{t("branding.logo.urlLabel")}</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://cdn.corelia.academy/brand/corelia-logo-1300.png"
              className="min-w-0 flex-1"
            />
            <Button type="button" disabled={saving} onClick={() => void handleSaveUrl()}>
              {saving ? t("branding.saving") : t("branding.logo.saveUrl")}
            </Button>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">{t("branding.logo.urlHint")}</p>
        </Field>
      </div>
    </div>
  );
}
