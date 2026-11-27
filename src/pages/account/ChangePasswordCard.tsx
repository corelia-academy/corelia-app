import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { changePasswordWithReauthentication } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH, passwordMeetsProjectPolicy } from "@/lib/passwordPolicy";
import { getAuthErrorInfo } from "@/pages/login/loginErrors";
import { SettingsRow } from "./SettingsLayout";

function ChangePasswordModal({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation("account");
  const { t: tAuth } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const changeMutation = useMutation({ mutationFn: changePasswordWithReauthentication });
  const incomplete = !currentPassword || !newPassword || !confirmPassword;

  async function handleSave() {
    if (changeMutation.isPending || incomplete) return;
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t("password.errors.confirmMismatch"));
      return;
    }
    if (!passwordMeetsProjectPolicy(newPassword)) {
      setError(t("password.errors.policy"));
      return;
    }
    const email = user.email;
    if (!email) {
      setError(t("password.errors.missingEmail"));
      return;
    }

    try {
      await changeMutation.mutateAsync({ email, currentPassword, newPassword });
      onOpenChange(false);
      toast.success(t("password.success.changed"));
    } catch (err) {
      const info = getAuthErrorInfo(err, (key, opts) => String(tAuth(key as never, opts as never)));
      setError(info.message || t("password.errors.changeFailed"));
    }
  }

  return (
    <Modal
      type="slot"
      open={open}
      onOpenChange={onOpenChange}
      title={t("password.title")}
      description={t("password.subtitle")}
      cancelLabel={tc("actions.cancel")}
      confirmLabel={changeMutation.isPending ? t("common.loading") : t("password.actions.submit")}
      closeLabel={tc("actions.close")}
      confirmDisabled={changeMutation.isPending || incomplete}
      onConfirm={() => void handleSave()}
    >
      <form className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
        <Field label={t("password.fields.current.label")}>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t("password.fields.current.placeholder")}
          />
        </Field>
        <Field label={t("password.fields.next.label")}>
          <Input
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("password.fields.next.placeholder")}
          />
        </Field>
        <Field label={t("password.fields.confirm.label")}>
          <Input
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("password.fields.confirm.placeholder")}
          />
        </Field>
        {error ? <p role="alert" className="text-body-medium text-input-field-error">{error}</p> : null}
        {/* Nút ẩn để phím Enter gửi được form có nhiều ô */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Dòng "Mật khẩu"; chỉ hiện với tài khoản đăng nhập bằng email. */
export function ChangePasswordCard({ user }: { user: User }) {
  const { t } = useTranslation("account");
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  if (!(user.identities?.some((identity) => identity.provider === "email") ?? false)) return null;

  return (
    <>
      <SettingsRow
        title={t("settings.account.password")}
        description={t("password.subtitle")}
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
            {t("password.title")}
          </Button>
        }
      />
      <ChangePasswordModal key={session} user={user} open={open} onOpenChange={setOpen} />
    </>
  );
}
