import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { uploadCoreliaLogo } from "@/lib/storage";
import { setSystemSetting } from "@/lib/systemSettings";
import { adminBrandingQueryOptions, adminKeys } from "@/features/admin/adminQueries";
import { useAuth } from "@/stores/authStore";

const LOGO_KEY = "corelia_logo_url";
const APP_BASE_URL_KEY = "corelia_app_base_url";

// Must be a bare origin (scheme://host, optional port) — no trailing slash,
// path, query, or fragment. Templates append their own leading "/" when
// building links, so a stray trailing "/" or "@" here corrupts every
// generated URL (course cert emails, mint notifications, ghost-mint claim
// links all share this same setting via getAppBaseUrl()).
const APP_BASE_URL_REGEX = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;

export default function AdminBranding() {
  const { t } = useTranslation("admin");
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const brandingQuery = useQuery(
    adminBrandingQueryOptions(LOGO_KEY, APP_BASE_URL_KEY, user?.id),
  );
  const [logoUrl, setLogoUrl] = useState("");
  const [appBaseUrl, setAppBaseUrl] = useState("");

  useEffect(() => {
    if (!brandingQuery.data) return;
    setLogoUrl(brandingQuery.data.logoUrl);
    setAppBaseUrl(brandingQuery.data.appBaseUrl);
  }, [brandingQuery.data]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { url } = await uploadCoreliaLogo(file);
      await setSystemSetting(LOGO_KEY, url);
      return url;
    },
    onSuccess: (url) => {
      setLogoUrl(url);
      toast.success(t("branding.uploaded"));
      void queryClient.invalidateQueries({ queryKey: adminKeys.branding(user?.id ?? "missing") });
    },
  });
  const saveLogoMutation = useMutation({
    mutationFn: (url: string) => setSystemSetting(LOGO_KEY, url),
    onSuccess: () => {
      toast.success(t("branding.saved"));
      void queryClient.invalidateQueries({ queryKey: adminKeys.branding(user?.id ?? "missing") });
    },
  });
  const saveBaseUrlMutation = useMutation({
    mutationFn: (url: string) => setSystemSetting(APP_BASE_URL_KEY, url),
    onSuccess: (_result, url) => {
      setAppBaseUrl(url);
      toast.success(t("branding.saved"));
      void queryClient.invalidateQueries({ queryKey: adminKeys.branding(user?.id ?? "missing") });
    },
  });

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    try {
      await uploadMutation.mutateAsync(file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("branding.uploadFailed"));
    } finally { /* mutation owns pending state */ }
  };

  const handleSaveUrl = async () => {
    try {
      await saveLogoMutation.mutateAsync(logoUrl.trim());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("branding.saveFailed"));
    } finally { /* mutation owns pending state */ }
  };

  const handleSaveAppBaseUrl = async () => {
    const trimmed = appBaseUrl.trim();
    if (!APP_BASE_URL_REGEX.test(trimmed)) {
      toast.error(t("branding.appBaseUrl.invalidUrl"));
      return;
    }
    try {
      await saveBaseUrlMutation.mutateAsync(trimmed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("branding.saveFailed"));
    } finally { /* mutation owns pending state */ }
  };

  if (brandingQuery.isPending) {
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
              disabled={uploadMutation.isPending}
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              {uploadMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              {uploadMutation.isPending ? t("branding.uploading") : t("branding.logo.uploadButton")}
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
            <Button type="button" disabled={saveLogoMutation.isPending} onClick={() => void handleSaveUrl()}>
              {saveLogoMutation.isPending ? t("branding.saving") : t("branding.logo.saveUrl")}
            </Button>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">{t("branding.logo.urlHint")}</p>
        </Field>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("branding.appBaseUrl.title")}</h2>
        <p className="mt-1 text-sm text-foreground-muted">{t("branding.appBaseUrl.subtitle")}</p>
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface-base p-4 sm:p-6">
        <Field>
          <FieldLabel>{t("branding.appBaseUrl.urlLabel")}</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={appBaseUrl}
              onChange={(e) => setAppBaseUrl(e.target.value)}
              placeholder="https://staging.corelia.academy"
              className="min-w-0 flex-1"
            />
            <Button type="button" disabled={saveBaseUrlMutation.isPending} onClick={() => void handleSaveAppBaseUrl()}>
              {saveBaseUrlMutation.isPending ? t("branding.saving") : t("branding.appBaseUrl.saveUrl")}
            </Button>
          </div>
        </Field>
      </div>
    </div>
  );
}
