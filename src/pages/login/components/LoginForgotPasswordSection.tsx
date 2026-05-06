import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AuthErrorInfo } from "@/pages/login/loginErrors";
import { useTranslation } from "react-i18next";

export function LoginForgotPasswordSection({
  email,
  loading,
  errorInfo,
  successMessage,
  onEmailChange,
  onBackToSignIn,
  onBackArrow,
  beforeSubmit,
}: {
  email: string;
  loading: boolean;
  errorInfo: AuthErrorInfo | null;
  successMessage: string | null;
  onEmailChange: (email: string) => void;
  onBackToSignIn: () => void;
  onBackArrow: () => void;
  beforeSubmit?: React.ReactNode;
}) {
  const { t } = useTranslation("auth");
  return (
    <>
      <Field>
        <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
        <Input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ban@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
        />
      </Field>

      {successMessage ? (
        <div className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          {successMessage}
        </div>
      ) : null}

      {errorInfo ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorInfo.message}
        </div>
      ) : null}

      {successMessage ? null : beforeSubmit}

      <Field>
        {successMessage ? (
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-md"
            onClick={onBackToSignIn}
          >
            {t("login.forgotPassword.backToSignIn")}
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-md"
          >
            {loading
              ? t("login.forgotPassword.submitting")
              : t("login.forgotPassword.submit")}
          </Button>
        )}
      </Field>

      <FieldDescription className="text-center">
        <button
          type="button"
          onClick={onBackArrow}
          className="font-medium underline underline-offset-2 text-muted-foreground hover:text-foreground"
        >
          {t("login.forgotPassword.backArrow")}
        </button>
      </FieldDescription>
    </>
  );
}

