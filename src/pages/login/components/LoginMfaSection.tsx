import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AuthErrorInfo } from "@/pages/login/loginErrors";
import { useTranslation } from "react-i18next";

export function LoginMfaSection({
  loading,
  mfaVerificationId,
  mfaCode,
  errorInfo,
  onSendCode,
  onCodeChange,
  onVerify,
  onBack,
}: {
  loading: boolean;
  mfaVerificationId: string | null;
  mfaCode: string;
  errorInfo: AuthErrorInfo | null;
  onSendCode: () => void;
  onCodeChange: (code: string) => void;
  onVerify: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation("auth");
  return (
    <>
      {!mfaVerificationId ? (
        <Field>
          <p className="text-sm text-muted-foreground">
            {t("login.mfa.sendCodeHint")}
          </p>
          <Button
            id="mfa-send-code-btn"
            type="button"
            disabled={loading}
            className="mt-2 w-full"
            onClick={onSendCode}
          >
            {loading ? t("login.mfa.sending") : t("login.mfa.sendCode")}
          </Button>
        </Field>
      ) : (
        <Field>
          <p className="text-sm text-success">{t("login.mfa.sentHint")}</p>
        </Field>
      )}

      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="mfa-code">{t("login.mfa.codeLabel")}</FieldLabel>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t("login.mfa.codePlaceholder")}
            value={mfaCode}
            onChange={(e) =>
              onCodeChange(e.target.value.replace(/\\D/g, "").slice(0, 6))
            }
            maxLength={6}
            className="font-mono text-lg tracking-widest"
          />
        </Field>

        {errorInfo ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorInfo.message}
          </div>
        ) : null}

        <Field className="flex gap-2">
          <Button
            type="button"
            disabled={loading || !mfaVerificationId}
            className="flex-1"
            onClick={onVerify}
          >
            {loading ? t("login.mfa.verifying") : t("login.mfa.verify")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={loading}
          >
            Quay lại
          </Button>
        </Field>
      </div>
    </>
  );
}

