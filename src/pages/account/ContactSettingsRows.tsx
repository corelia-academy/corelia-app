import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { connectedIdentitiesQueryOptions } from "@/features/account/accountQueries";
import { updateProfileForUser } from "@/lib/profile";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/stores/authStore";
import { SettingsRow } from "./SettingsLayout";

export function EmailSettingsRow() {
  const { t } = useTranslation("account");
  const { user } = useAuth();
  const identities = useQuery(connectedIdentitiesQueryOptions(user?.id));
  const providers = identities.data?.map((identity) => identity.provider);
  // Ưu tiên Google rồi GitHub; còn lại là tài khoản Email
  const signInProvider = providers?.includes("google") ? "Google" : providers?.includes("github") ? "GitHub" : "Email";

  return (
    <SettingsRow
      title={t("profile.emailLoginLabel")}
      description={user?.email ?? user?.id}
      action={
        providers ? (
          <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled>
            {t("settings.account.signedInWith", { provider: signInProvider })}
          </Button>
        ) : undefined
      }
    />
  );
}

function ChangePhoneModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation("account");
  const { t: tc } = useTranslation("common");
  const { user, profile, refreshProfile } = useAuth();
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfileForUser(user, { phone: phone.trim() || null });
      await refreshProfile(user);
      void queryClient.invalidateQueries({ queryKey: ["xp"] });
      onOpenChange(false);
      toast.success(t("profile.success.updated"));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(raw.includes("profile_text_invalid") ? t("profile.errors.invalidText") : raw || t("profile.errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      type="slot"
      open={open}
      onOpenChange={onOpenChange}
      title={t("settings.account.changePhone")}
      description={t("profile.phone.hint")}
      cancelLabel={tc("actions.cancel")}
      confirmLabel={tc("actions.confirm")}
      closeLabel={tc("actions.close")}
      confirmDisabled={saving}
      onConfirm={() => void handleSave()}
    >
      <form onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
        <Field label={t("profile.phone.label")} error={error}>
          <Input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("profile.phone.placeholder")}
          />
        </Field>
      </form>
    </Modal>
  );
}

/** Dòng "Số điện thoại"; logic lưu giữ nguyên từ form thông tin cá nhân cũ. */
export function PhoneSettingsRow() {
  const { t } = useTranslation("account");
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  return (
    <>
      <SettingsRow
        title={t("profile.phone.label")}
        description={profile?.phone || t("profile.phone.hint")}
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
            {t("settings.account.changePhone")}
          </Button>
        }
      />
      <ChangePhoneModal key={session} open={open} onOpenChange={setOpen} />
    </>
  );
}
