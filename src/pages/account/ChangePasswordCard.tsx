import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { PASSWORD_MIN_LENGTH, passwordMeetsProjectPolicy } from "@/lib/passwordPolicy";
import { getAuthErrorInfo } from "@/pages/login/loginErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

export function ChangePasswordCard({ user }: { user: User }) {
  const { t } = useTranslation("account");
  const { t: tAuth } = useTranslation("auth");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasPasswordProvider =
    user.identities?.some((i) => i.provider === "email") ?? false;

  async function onSubmitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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

    setLoading(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) throw reauthError;

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setSuccess(t("password.success.changed"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const info = getAuthErrorInfo(err, (key, opts) =>
        String(tAuth(key as never, opts as never)),
      );
      setError(info.message || t("password.errors.changeFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (!hasPasswordProvider) return null;

  return (
    <div className="space-y-4 rounded-lg border border-border-subtle bg-surface-base p-4">
      <div>
        <h2 className="text-lg font-semibold">{t("password.title")}</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("password.subtitle")}
        </p>
      </div>
      <form onSubmit={(e) => void onSubmitPasswordChange(e)} className="grid gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="current_password">
            {t("password.fields.current.label")}
          </Label>
          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t("password.fields.current.placeholder")}
            required
            className="rounded"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="new_password">
            {t("password.fields.next.label")}
          </Label>
          <Input
            id="new_password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("password.fields.next.placeholder")}
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="rounded"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="confirm_password">
            {t("password.fields.confirm.label")}
          </Label>
          <Input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("password.fields.confirm.placeholder")}
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="rounded"
          />
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive-muted px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-md border border-success/25 bg-success-muted px-3 py-2 text-sm text-success">
            {success}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? t("common.loading") : t("password.actions.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
