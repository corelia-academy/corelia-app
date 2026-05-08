import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileSection(props: {
  sessionEmail: string;
  username: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  bio: string;
  website: string;
  profilePublic: boolean;
  profileLinkHandle: string;
  setFullName: (v: string) => void;
  setPhone: (v: string) => void;
  setUsername: (v: string) => void;
  setBio: (v: string) => void;
  setWebsite: (v: string) => void;
  setProfilePublic: (v: boolean) => void;
  saving: boolean;
  uploadingAvatar: boolean;
  onAvatarUpload: (file: File) => Promise<void>;
  error: string | null;
  success: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    sessionEmail,
    username,
    fullName,
    phone,
    avatarUrl,
    bio,
    website,
    profilePublic,
    profileLinkHandle,
    setFullName,
    setPhone,
    setUsername,
    setBio,
    setWebsite,
    setProfilePublic,
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

        <div className="grid gap-2 rounded-md border border-border-subtle bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground">
            {t("profile.publicProfile.label")}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {profilePublic
                  ? t("profile.publicProfile.status.public")
                  : t("profile.publicProfile.status.private")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("profile.publicProfile.hint", { handle: profileLinkHandle })}
              </div>
            </div>
            <button
              type="button"
              disabled={saving || uploadingAvatar}
              onClick={() => setProfilePublic(!profilePublic)}
              className={[
                "min-h-11 rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                profilePublic
                  ? "border-primary/25 bg-primary-container text-on-primary-container shadow-card"
                  : "border-border-subtle bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              ].join(" ")}
            >
              {profilePublic
                ? t("profile.publicProfile.actions.makePrivate")
                : t("profile.publicProfile.actions.makePublic")}
            </button>
          </div>
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
          <Label className="text-sm font-medium" htmlFor="username">
            {t("profile.username.label")}
          </Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("profile.username.placeholder")}
            className="rounded"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />
          <p className="text-xs text-muted-foreground">
            {t("profile.username.hint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="bio">
            {t("profile.bio.label")}
          </Label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t("profile.bio.placeholder")}
            className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <p className="text-xs text-muted-foreground">
            {t("profile.bio.hint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="website">
            {t("profile.website.label")}
          </Label>
          <Input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={t("profile.website.placeholder")}
            className="rounded"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            {t("profile.website.hint")}
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

