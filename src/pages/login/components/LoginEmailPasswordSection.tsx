import { AlertCircle, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AuthErrorInfo } from "@/pages/login/loginErrors";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy";

export type AuthMode = "sign_in" | "sign_up";

export function LoginEmailPasswordSection({
  mode,
  loading,
  title,
  email,
  password,
  confirmPassword,
  fullName,
  errorInfo,
  isAccountExistsError,
  isEmailNotConfirmedError,
  onResendConfirmation,
  resendLoading,
  inlineSuccessMessage,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onFullNameChange,
  onForgotPassword,
  onToggleMode,
  beforeSubmit,
}: {
  mode: AuthMode;
  loading: boolean;
  title: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  errorInfo: AuthErrorInfo | null;
  isAccountExistsError: boolean;
  isEmailNotConfirmedError: boolean;
  onResendConfirmation?: () => void | Promise<void>;
  resendLoading?: boolean;
  inlineSuccessMessage?: string | null;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onConfirmPasswordChange: (password: string) => void;
  onFullNameChange: (name: string) => void;
  onForgotPassword: () => void;
  onToggleMode: () => void;
  beforeSubmit?: React.ReactNode;
}) {
  const { t } = useTranslation("auth");
  return (
    <>
      {mode === "sign_up" ? (
        <Field>
          <FieldLabel htmlFor="fullName">{t("login.fields.fullName")}</FieldLabel>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder={t("login.placeholders.fullName")}
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            required
          />
        </Field>
      ) : null}

      <Field>
        <FieldLabel htmlFor="email">{t("login.fields.email")}</FieldLabel>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("login.placeholders.email")}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
        />
      </Field>

      <Field>
        <div className="flex items-center">
          <FieldLabel htmlFor="password">{t("login.fields.password")}</FieldLabel>
          {mode === "sign_in" ? (
            <button
              type="button"
              onClick={onForgotPassword}
              className="ml-auto text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              {t("login.actions.forgotPassword")}
            </button>
          ) : null}
        </div>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
          placeholder={
            mode === "sign_in"
              ? t("login.placeholders.passwordSignIn")
              : t("login.placeholders.passwordSignUp")
          }
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          {...(mode === "sign_up" ? { minLength: PASSWORD_MIN_LENGTH } : {})}
        />
      </Field>

      {mode === "sign_up" ? (
        <Field>
          <FieldLabel htmlFor="confirmPassword">
            {t("login.fields.confirmPassword")}
          </FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder={t("login.placeholders.confirmPassword")}
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
          />
        </Field>
      ) : null}

      {beforeSubmit}

      {inlineSuccessMessage && mode === "sign_in" ? (
        <div className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          {inlineSuccessMessage}
        </div>
      ) : null}

      {errorInfo ? (
        isAccountExistsError ? (
          <div
            className="flex gap-3 rounded-md border border-warning/20 bg-warning/10 p-4"
            role="alert"
          >
            <AlertCircle className="size-5 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-warning">
                {t("login.hints.accountExistsTitle")}
              </p>
              <p className="text-sm text-warning">{errorInfo.message}</p>
              <p className="mt-1.5 text-xs text-warning">
                {t("login.hints.accountExistsSuggestionPrefix")}{" "}
                <strong>{t("login.hints.accountExistsEmailPassword")}</strong>{" "}
                {t("login.hints.accountExistsSuggestionOrButton")}{" "}
                <strong>Google</strong> / <strong>GitHub</strong>{" "}
                {t("login.hints.accountExistsSuggestionSuffix")}
              </p>
            </div>
          </div>
        ) : isEmailNotConfirmedError && mode === "sign_in" ? (
          <div
            className="flex flex-col gap-3 rounded-md border border-warning/20 bg-warning/10 p-4"
            role="alert"
          >
            <div className="flex gap-3">
              <Mail className="size-5 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-warning">
                  {t("login.emailConfirmation.title")}
                </p>
                <p className="text-sm text-warning">{errorInfo.message}</p>
                <p className="text-xs text-warning">{t("login.emailConfirmation.hint")}</p>
              </div>
            </div>
            {onResendConfirmation ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-warning/30 bg-background/50"
                disabled={Boolean(loading || resendLoading)}
                onClick={() => void onResendConfirmation()}
              >
                {resendLoading
                  ? t("login.emailConfirmation.resending")
                  : t("login.emailConfirmation.resend")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorInfo.message}
          </div>
        )
      ) : null}

      <Field>
        <Button type="submit" disabled={loading} className="w-full rounded-md">
          {loading ? t("login.actions.processing") : title}
        </Button>
      </Field>

      <FieldDescription className="text-center">
        {mode === "sign_in" ? t("login.actions.newUser") : t("login.actions.haveAccount")}
        <button
          type="button"
          onClick={onToggleMode}
          disabled={loading}
          className="font-medium underline underline-offset-2 disabled:opacity-50"
        >
          {mode === "sign_in"
            ? t("login.actions.createAccount")
            : t("login.actions.signIn")}
        </button>
      </FieldDescription>
    </>
  );
}

