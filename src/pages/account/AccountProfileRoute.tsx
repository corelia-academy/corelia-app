import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { UserCircle } from "lucide-react";
import type { Profile } from "@/types/database";
import { useAuth } from "@/stores/authStore";
import { updateProfileForUser, uploadAvatarForUser } from "@/lib/profile";
import { Skeleton } from "@/components/ui/skeleton";
import ConnectOCIDCard from "@/pages/account/ConnectOCIDCard";
import { ChangePasswordCard } from "./ChangePasswordCard";
import { ProfileSection } from "./ProfileSection";

function useProfileForm(profile: Profile | null) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [profilePublic, setProfilePublic] = useState(profile?.profile_public ?? true);

  return {
    fullName,
    phone,
    avatarUrl,
    username,
    bio,
    website,
    profilePublic,
    setFullName,
    setPhone,
    setAvatarUrl,
    setUsername,
    setBio,
    setWebsite,
    setProfilePublic,
  };
}

export function AccountProfileRoute() {
  const { t } = useTranslation("account");
  const { user, profile, loading, authInitialized, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const needsProfileSetup = Boolean(
    user && profile && (!profile.full_name || !profile.phone),
  );

  const {
    fullName,
    phone,
    avatarUrl,
    username,
    bio,
    website,
    profilePublic,
    setFullName,
    setPhone,
    setAvatarUrl,
    setUsername,
    setBio,
    setWebsite,
    setProfilePublic,
  } = useProfileForm(profile);

  // Sync form fields when profile arrives after initial render
  const profileId = profile?.id;
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setWebsite(profile.website ?? "");
    setProfilePublic(profile.profile_public ?? true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function onAvatarUpload(file: File) {
    if (!user) return;
    setError(null);
    setSuccess(null);
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatarForUser(user, file);
      setAvatarUrl(url);
      await updateProfileForUser(user, { avatar_url: url });
      await refreshProfile(user);
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
      if (!user) return;
      await updateProfileForUser(user, {
        username: username.trim() || null,
        full_name: fullName || null,
        phone: phone || null,
        avatar_url: avatarUrl || null,
        bio: bio.trim() || null,
        website: website.trim() || null,
        profile_public: profilePublic,
      });
      await refreshProfile(user);
      setSuccess(t("profile.success.updated"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("profile.errors.updateFailed");
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!authInitialized || (loading && !profile)) {
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

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {t("profile.errors.loadFailed")}
        </p>
        <button
          type="button"
          onClick={() => void refreshProfile(user)}
          className="rounded-md border border-border-subtle bg-card px-4 py-2 text-sm transition-colors hover:bg-muted"
        >
          {t("profile.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {needsProfileSetup ? (
        <div className="rounded-md border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
          <p className="font-medium">{t("profile.setupWarning.title")}</p>
          <p className="mt-2 leading-relaxed">{t("profile.setupWarning.body")}</p>
        </div>
      ) : null}

      <ProfileSection
        key={profile.updated_at || profile.id}
        sessionEmail={user.email ?? user.id}
        username={username}
        fullName={fullName}
        phone={phone}
        avatarUrl={avatarUrl}
        bio={bio}
        website={website}
        profilePublic={profilePublic}
        profileLinkHandle={username.trim() || profile.ocid?.trim() || profile.id}
        setFullName={setFullName}
        setPhone={setPhone}
        saving={saving}
        uploadingAvatar={uploadingAvatar}
        onAvatarUpload={onAvatarUpload}
        setUsername={setUsername}
        setBio={setBio}
        setWebsite={setWebsite}
        setProfilePublic={setProfilePublic}
        error={error}
        success={success}
        onSubmit={onSubmitProfile}
      />

      <ConnectOCIDCard />
      <ChangePasswordCard user={user} />
    </div>
  );
}
