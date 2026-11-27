import { useState } from "react";
import { Info } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TooltipPreview } from "@/components/ui/tooltip";
import { updateProfileForUser } from "@/lib/profile";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/stores/authStore";
import { SettingsRow } from "./SettingsLayout";

function ChangeUsernameModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation("account");
  const { t: tc } = useTranslation("common");
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user || saving) return;
    const newUsername = username.trim() || null;
    // Chỉ gửi username khi thực sự thay đổi (tránh unique constraint tự conflict)
    if (newUsername?.toLowerCase() === (profile?.username ?? "").toLowerCase() || (!newUsername && !profile?.username)) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfileForUser(user, { username: newUsername });
      await refreshProfile(user);
      void queryClient.invalidateQueries({ queryKey: ["xp"] });
      onOpenChange(false);
      toast.success(t("profile.success.updated"));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(
        raw.includes("profiles_username_lower_key") || raw.includes("duplicate key") || raw.includes("23505")
          ? t("profile.errors.usernameTaken")
          : raw.includes("profile_text_invalid") || raw.includes("profile_username_too_long")
            ? t("profile.errors.invalidText")
            : raw || t("profile.errors.updateFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      type="slot"
      open={open}
      onOpenChange={onOpenChange}
      title={t("settings.account.changeUsername")}
      description={t("settings.account.usernameInfo")}
      cancelLabel={tc("actions.cancel")}
      confirmLabel={tc("actions.confirm")}
      confirmDisabled={saving}
      onConfirm={() => void handleSave()}
    >
      <Field label={t("profile.username.label")} hint={t("profile.username.hint")} error={error}>
        <Input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder={t("profile.username.placeholder")}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
    </Modal>
  );
}

/** Dòng "Username" trong nhóm Tài khoản; logic lưu giữ nguyên từ form thông tin cá nhân cũ. */
export function UsernameSettingsRow() {
  const { t } = useTranslation("account");
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  return (
    <>
      <SettingsRow
        title={t("profile.username.label")}
        info={
          <TooltipPreview
            arrow="top-center"
            side="bottom"
            triggerLabel={t("settings.account.usernameInfo")}
            triggerClassName="size-6 [@media(pointer:coarse)]:size-11"
            trigger={<Info className="size-5" weight="duotone" aria-hidden />}
            supportingText={t("settings.account.usernameInfo")}
          >
            {t("profile.username.label")}
          </TooltipPreview>
        }
        description={profile?.username || t("settings.account.noUsername")}
        action={
          <Button
            type="button"
            variant="cta"
            hierarchy="secondary"
            size="small"
            onClick={() => {
              setSession((n) => n + 1);
              setOpen(true);
            }}
          >
            {t("settings.account.changeUsername")}
          </Button>
        }
      />
      <ChangeUsernameModal key={session} open={open} onOpenChange={setOpen} />
    </>
  );
}
