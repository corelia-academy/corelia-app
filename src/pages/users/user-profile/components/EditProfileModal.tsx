import { useState } from "react";
import { Globe, Lock, Plus } from "@phosphor-icons/react";
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
import type { InstructorSocialLink } from "@/types/database";
import { filledLinks, isValidHttpUrl, LINK_ICONS, toLinkFields } from "../utils/profileDisplay";

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
  const [links, setLinks] = useState(() => toLinkFields(profile?.instructor_social_links ?? []));
  const [showWebsite, setShowWebsite] = useState(Boolean(profile?.website));
  const nextLinks = filledLinks(links);
  // Chỉ gửi link khi có thay đổi, để sửa tên không làm đảo thứ tự link của giảng viên
  const linksChanged = JSON.stringify(nextLinks) !== JSON.stringify(filledLinks(toLinkFields(profile?.instructor_social_links ?? [])));
  const isPublic = profile?.profile_public ?? true;
  const VisibilityIcon = isPublic ? Globe : Lock;
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function requestSave() {
    if ([...nextLinks.map((link) => link.url), website.trim()].some((url) => url && !isValidHttpUrl(url))) {
      setError(tAccount("instructorProfile.socialLinks.errors.urlInvalid"));
      return;
    }
    setError(null);
    setConfirmOpen(true);
  }

  function linkInput(link: InstructorSocialLink, index: number) {
    const Icon = LINK_ICONS[link.platform] ?? Globe;
    const placeholder = link.platform === "github" ? t("userProfile.edit.linkGithub")
      : link.platform === "linkedin" ? t("userProfile.edit.linkLinkedin") : t("userProfile.edit.linkOther");
    return (
      <Input
        key={index}
        type="url"
        variant="icon-leading"
        statusIcon={null}
        leadingIcon={<Icon className="size-5" weight="duotone" aria-hidden />}
        aria-label={link.label?.trim() || placeholder}
        placeholder={placeholder}
        value={link.url}
        onChange={(e) => setLinks((prev) => prev.map((item, i) => (i === index ? { ...item, url: e.target.value } : item)))}
      />
    );
  }

  async function handleSave() {
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfileForUser(user, {
        full_name: fullName.trim() || null,
        bio: bio.trim() || null,
        website: website.trim() || null,
        ...(linksChanged ? { instructor_social_links: nextLinks.length ? nextLinks : null } : {}),
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
        onConfirm={requestSave}
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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-title-medium text-foreground-subtle">{t("userProfile.info.links")}</p>
              <span className="flex items-center gap-1.5 text-body-medium text-foreground-subtle">
                <VisibilityIcon className="size-4" weight="duotone" aria-hidden />
                {tAccount(isPublic ? "profile.publicProfile.status.public" : "profile.publicProfile.status.private")}
              </span>
            </div>
            <p className="text-body-small text-foreground-subtle">{t("userProfile.edit.linksHint")}</p>
            {links.slice(0, 2).map((link, index) => linkInput(link, index))}
            {showWebsite ? (
              <Input
                type="url"
                variant="icon-leading"
                statusIcon={null}
                leadingIcon={<Globe className="size-5" weight="duotone" aria-hidden />}
                aria-label={tAccount("profile.website.label")}
                placeholder={t("userProfile.edit.linkOther")}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            ) : null}
            {links.slice(2).map((link, index) => linkInput(link, index + 2))}
            <Button
              type="button"
              variant="cta"
              hierarchy="tertiary"
              size="small"
              className="self-center"
              trailingIcon={<Plus className="size-4" aria-hidden />}
              onClick={() => (showWebsite ? setLinks((prev) => [...prev, { platform: "other", url: "" }]) : setShowWebsite(true))}
            >
              {t("userProfile.edit.addLink")}
            </Button>
          </div>
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
