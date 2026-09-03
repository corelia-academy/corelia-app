import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { updateAuthPassword } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";
import { PASSWORD_MIN_LENGTH, passwordMeetsProjectPolicy } from "@/lib/passwordPolicy";
import { getAuthErrorInfo } from "@/pages/login/loginErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/base/LanguageSwitcher";
import { useTranslation } from "react-i18next";

export default function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery);
  const user = useAuthStore((s) => s.user);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordMutation = useMutation({ mutationFn: updateAuthPassword });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }
    if (!passwordMeetsProjectPolicy(newPassword)) {
      setError(t("errors.passwordPolicyMissingClasses"));
      return;
    }

    try {
      await passwordMutation.mutateAsync(newPassword);
      setSuccess(true);
      setPasswordRecovery(false);
      setTimeout(() => void navigate("/", { replace: true }), 2000);
    } catch (err) {
      const info = getAuthErrorInfo(err, (key, opts) =>
        String(t(key as never, opts as never)),
      );
      setError(info.message || t("resetPassword.errorGeneric"));
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-auth-page p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-center space-y-4">
            <p className="text-foreground-muted text-sm">{t("resetPassword.sessionExpired")}</p>
            <NavLink
              to="/login"
              className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("resetPassword.backToSignIn")}
            </NavLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-auth-page p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <NavLink
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>{t("resetPassword.backHome")}</span>
          </NavLink>
          <LanguageSwitcher />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div>
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              {t("resetPassword.title")}
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("resetPassword.subtitle")}
            </p>
          </div>

          {success ? (
            <div className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
              {t("resetPassword.successMessage")}
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new_password">{t("resetPassword.newPasswordLabel")}</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("login.placeholders.passwordSignUp")}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  className="rounded"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_password">{t("resetPassword.confirmPasswordLabel")}</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("login.placeholders.confirmPassword")}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  className="rounded"
                />
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" disabled={passwordMutation.isPending} className="w-full">
                {passwordMutation.isPending ? t("resetPassword.submitting") : t("resetPassword.submit")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
