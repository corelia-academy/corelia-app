import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { updateProfileForUser } from "@/lib/profile";
import { PROFILE_NAME_MAX_LENGTH } from "@/lib/profileName";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/stores/authStore";

export function EditProfileModal({
  open,
  onOpenChange,
  onEditAvatar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditAvatar: () => void;
}) {
  const { t } = useTranslation("common");
  const { t: tAccount } = useTranslation("account");
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfileForUser(user, {
        full_name: fullName.trim() || null,
        bio: bio.trim() || null,
        website: website.trim() || null,
      });
      await refreshProfile(user);
      void queryClient.invalidateQueries({ queryKey: ["xp"] });
      setConfirmOpen(false);
      onOpenChange(false);
      toast.success(tAccount("profile.success.updated"));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setConfirmOpen(false);
      setError(
        raw.includes("profile_name_")
          ? tAccount("profile.errors.invalidName")
          : raw.includes("profile_text_invalid")
            ? tAccount("profile.errors.invalidText")
            : raw || tAccount("profile.errors.updateFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        type="slot"
        open={open}
        onOpenChange={onOpenChange}
        title={t("userProfile.actions.editProfile")}
        description={t("userProfile.edit.subtitle")}
        cancelLabel={t("userProfile.edit.cancel")}
        confirmLabel={t("userProfile.edit.confirm")}
        onConfirm={() => setConfirmOpen(true)}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <UserAvatar
              userId={user?.id ?? null}
              avatarUrl={profile?.avatar_url ?? ""}
              avatarSeed={profile?.avatar_seed ?? null}
              avatarConfig={profile?.avatar_config}
              alt={tAccount("profile.avatar.alt")}
              fallback={fullName.trim().slice(0, 2).toUpperCase() || "?"}
              className="size-16 shrink-0 rounded-full"
            />
            <Button type="button" variant="cta" hierarchy="secondary" onClick={onEditAvatar}>
              {tAccount("avatarEditor.edit")}
            </Button>
          </div>
          {/* TODO(figma-cover): chưa có cột ảnh bìa trong DB nên chưa có nút đổi ảnh bìa */}
          <Field label={tAccount("profile.fullName.label")} hint={tAccount("profile.fullName.hint")}>
            <Input
              value={fullName}
              maxLength={PROFILE_NAME_MAX_LENGTH}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={tAccount("profile.fullName.placeholder")}
            />
          </Field>
          {/* TODO(figma-bio-limit): Figma có bộ đếm 0/500; form cũ không giới hạn bio */}
          <Field label={tAccount("profile.bio.label")} hint={tAccount("profile.bio.hint")}>
            <Input
              fieldType="auto-grow"
              controlClassName="min-h-[124px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={tAccount("profile.bio.placeholder")}
            />
          </Field>
          {/* TODO(figma-links): Figma có Github, LinkedIn, "Thêm Link Khác"; app chỉ có một trường website */}
          <Field label={tAccount("profile.website.label")} hint={tAccount("profile.website.hint")}>
            <Input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={tAccount("profile.website.placeholder")}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-body-medium text-input-field-error">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
      <Modal
        type="confirmation"
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={tAccount("profile.actions.save")}
        description={t("userProfile.edit.confirmDescription")}
        cancelLabel={t("userProfile.edit.cancel")}
        confirmLabel={t("userProfile.edit.confirm")}
        confirmDisabled={saving}
        onConfirm={() => void handleSave()}
      />
    </>
  );
}
