import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

export function ChangePasswordCard({ user }: { user: User }) {
  const { t } = useTranslation("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasPasswordProvider = user.providerData?.some(
    (p) => p.providerId === "password",
  );

  async function onSubmitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError(t("password.errors.confirmMismatch"));
      return;
    }
    if (newPassword.length < 6) {
      setError(t("password.errors.minLength"));
      return;
    }
    const email = user.email;
    if (!email) {
      setError(t("password.errors.missingEmail"));
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error(t("errors.notLoggedIn"));
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setSuccess(t("password.success.changed"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("password.errors.changeFailed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!hasPasswordProvider) return null;

  return (
    <div className="space-y-4 rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div>
        <h2 className="text-base font-medium">{t("password.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
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
            minLength={6}
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
            minLength={6}
            className="rounded"
          />
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
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

