import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileSection(props: {
  sessionEmail: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  setFullName: (v: string) => void;
  setPhone: (v: string) => void;
  saving: boolean;
  uploadingAvatar: boolean;
  onAvatarUpload: (file: File) => Promise<void>;
  error: string | null;
  success: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    sessionEmail,
    fullName,
    phone,
    avatarUrl,
    setFullName,
    setPhone,
    saving,
    uploadingAvatar,
    onAvatarUpload,
    error,
    success,
    onSubmit,
  } = props;
  const { t } = useTranslation("account");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    void onAvatarUpload(file);
    e.target.value = "";
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      <div className="grid gap-4 rounded-md border border-border-subtle bg-card p-4 shadow-card">
        <div className="grid gap-2">
          <Label className="text-sm font-medium">{t("profile.emailLoginLabel")}</Label>
          <div className="text-sm text-muted-foreground">{sessionEmail}</div>
        </div>

        <div className="grid gap-3">
          <Label className="text-sm font-medium">{t("profile.avatar.label")}</Label>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-20 shrink-0 rounded-full">
              <AvatarImage src={avatarUrl || undefined} alt={t("profile.avatar.alt")} />
              <AvatarFallback className="text-lg">
                {fullName.trim()
                  ? fullName.trim().slice(0, 2).toUpperCase()
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
                disabled={uploadingAvatar || saving}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || saving}
                className="inline-flex items-center gap-2"
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                    {t("profile.avatar.uploading")}
                  </>
                ) : (
                  <>
                    <ImageIcon className="size-4 shrink-0" aria-hidden />
                    {t("profile.avatar.upload")}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("profile.avatar.hint")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="full_name">
            {t("profile.fullName.label")}
          </Label>
          <Input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("profile.fullName.placeholder")}
            className="rounded"
          />
          <p className="text-xs text-muted-foreground">
            {t("profile.fullName.hint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="phone">
            {t("profile.phone.label")}
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("profile.phone.placeholder")}
            className="rounded"
          />
          <p className="text-xs text-muted-foreground">
            {t("profile.phone.hint")}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success">
          {success}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t("profile.actions.saving") : t("profile.actions.save")}
        </Button>
      </div>
    </form>
  );
}

