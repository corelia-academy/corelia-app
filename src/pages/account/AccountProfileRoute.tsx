import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserCircle } from "lucide-react";
import type { Profile } from "@/types/database";
import { useAuth } from "@/stores/authStore";
import { updateCurrentProfile, uploadAvatar } from "@/lib/profile";
import { Skeleton } from "@/components/ui/skeleton";
import ConnectOCIDCard from "@/pages/account/ConnectOCIDCard";
import { ChangePasswordCard } from "./ChangePasswordCard";
import { MfaEnrollCard } from "./MfaEnrollCard";
import { ProfileSection } from "./ProfileSection";

function useProfileForm(profile: Profile | null) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");

  return {
    fullName,
    phone,
    avatarUrl,
    setFullName,
    setPhone,
    setAvatarUrl,
  };
}

export function AccountProfileRoute() {
  const { t } = useTranslation("account");
  const { user, profile, loading, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const needsProfileSetup = Boolean(
    user && profile && (!profile.full_name || !profile.phone),
  );

  const { fullName, phone, avatarUrl, setFullName, setPhone, setAvatarUrl } =
    useProfileForm(profile);

  async function onAvatarUpload(file: File) {
    setError(null);
    setSuccess(null);
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      await updateCurrentProfile({ avatar_url: url });
      await refreshProfile();
      setSuccess(t("profile.success.avatarUpdated"));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("profile.errors.avatarUploadFailed");
      setError(message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSubmitProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      await updateCurrentProfile({
        full_name: fullName || null,
        phone: phone || null,
        avatar_url: avatarUrl || null,
      });
      await refreshProfile();
      setSuccess(t("profile.success.updated"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("profile.errors.updateFailed");
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !profile) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
          <Skeleton className="h-6 w-56 rounded" />
          <Skeleton className="mt-2 h-4 w-full max-w-[520px] rounded" />
        </div>
        <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center gap-4">
            <Skeleton className="size-20 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-9 w-44 rounded" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-28 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <UserCircle className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("profile.mustLogin")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("header.subtitle")}
          </p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-6">
      {needsProfileSetup ? (
        <div className="rounded-md border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
          <p className="font-medium">{t("profile.setupWarning.title")}</p>
          <p className="mt-2 leading-relaxed">
            {t("profile.setupWarning.body")}
          </p>
        </div>
      ) : null}
      <ProfileSection
        key={profile.updated_at || profile.id}
        sessionEmail={user.email ?? user.uid}
        fullName={fullName}
        phone={phone}
        avatarUrl={avatarUrl}
        setFullName={setFullName}
        setPhone={setPhone}
        saving={saving}
        uploadingAvatar={uploadingAvatar}
        onAvatarUpload={onAvatarUpload}
        error={error}
        success={success}
        onSubmit={onSubmitProfile}
      />
      <ConnectOCIDCard />
      <ChangePasswordCard user={user} />
      <MfaEnrollCard user={user} />
    </div>
  );
}
