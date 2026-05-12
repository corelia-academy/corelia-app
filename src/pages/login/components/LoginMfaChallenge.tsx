import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getAuthErrorInfo,
  isEmailNotConfirmed,
  type AuthErrorInfo,
} from "@/pages/login/loginErrors";

type FactorChoice =
  | { kind: "totp"; id: string }
  | { kind: "phone"; id: string; phone?: string };

function pickVerifiedFactor(data: {
  totp: { id: string; status: string }[];
  phone: { id: string; status: string; phone?: string }[];
}): FactorChoice | null {
  const totp = data.totp?.find((f) => f.status === "verified");
  if (totp) return { kind: "totp", id: totp.id };
  const phone = data.phone?.find((f) => f.status === "verified");
  if (phone) return { kind: "phone", id: phone.id, phone: phone.phone };
  return null;
}

type Translate = (key: string, options?: { defaultValue?: string }) => string;

export function LoginMfaChallenge({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void | Promise<void>;
}) {
  const { t } = useTranslation("auth");
  const translate = useMemo<Translate>(
    () => (key, options) => String(t(key as never, options as never)),
    [t],
  );

  const [loadingFactors, setLoadingFactors] = useState(true);
  const [factor, setFactor] = useState<FactorChoice | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorInfo, setErrorInfo] = useState<AuthErrorInfo | null>(null);
  const [resendEmailBusy, setResendEmailBusy] = useState(false);
  const [resendEmailSuccess, setResendEmailSuccess] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    setLoadingFactors(true);
    setErrorInfo(null);
    setResendEmailSuccess(null);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const chosen = pickVerifiedFactor({
        totp: data?.totp ?? [],
        phone: data?.phone ?? [],
      });
      setFactor(chosen);
      if (!chosen) {
        setErrorInfo({ message: t("errors.auth__mfa-no-factors") });
      }
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
      setFactor(null);
    } finally {
      setLoadingFactors(false);
    }
  }, [t, translate]);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const handleResendConfirmationEmail = useCallback(async () => {
    setResendEmailBusy(true);
    setErrorInfo(null);
    setResendEmailSuccess(null);
    try {
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const mail = session?.user?.email?.trim();
      if (!mail) {
        setErrorInfo({ message: t("errors.generic") });
        return;
      }
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: mail,
      });
      if (error) throw error;
      setResendEmailSuccess(t("login.emailConfirmation.resendSuccess"));
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
    } finally {
      setResendEmailBusy(false);
    }
  }, [t, translate]);

  const startChallenge = useCallback(async () => {
    if (!factor) return;
    setBusy(true);
    setErrorInfo(null);
    try {
      const { data, error } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (error) throw error;
      setChallengeId(data.id);
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
      setChallengeId(null);
    } finally {
      setBusy(false);
    }
  }, [factor, translate]);

  useEffect(() => {
    if (!factor || loadingFactors) return;
    if (factor.kind === "totp") {
      void startChallenge();
    }
  }, [factor, loadingFactors, startChallenge]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factor || !challengeId) {
      if (factor?.kind === "phone") {
        setErrorInfo({ message: t("errors.auth__mfa-send-code-first") });
      }
      return;
    }
    const trimmed = code.trim();
    if (!trimmed) return;

    setBusy(true);
    setErrorInfo(null);
    setResendEmailSuccess(null);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId,
        code: trimmed,
      });
      if (error) throw error;
      onSuccess();
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
    } finally {
      setBusy(false);
    }
  }

  const subtitle =
    factor?.kind === "phone"
      ? t("login.subtitle.mfaPhone")
      : factor?.kind === "totp"
        ? t("login.subtitle.mfaTotp")
        : t("login.subtitle.mfa");

  if (loadingFactors) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-8">
        <Loader2 className="size-8 animate-spin text-foreground-muted" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-normal tracking-tight text-foreground">
          {t("login.title.mfa")}
        </h1>
        <p className="text-balance text-sm text-foreground-muted">{subtitle}</p>
        {factor?.kind === "phone" && factor.phone ? (
          <p className="text-xs text-foreground-muted">{factor.phone}</p>
        ) : null}
      </div>

      {factor?.kind === "totp" ? (
        <p className="text-center text-sm text-foreground-muted">{t("login.mfa.totpHint")}</p>
      ) : null}

      {resendEmailSuccess ? (
        <div className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          {resendEmailSuccess}
        </div>
      ) : null}

      <form onSubmit={(e) => void handleVerify(e)} className="flex flex-col gap-4">
        {factor?.kind === "phone" ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="w-full"
              onClick={() => void startChallenge()}
            >
              {busy
                ? t("login.mfa.sending")
                : challengeId
                  ? t("login.mfa.resendCode")
                  : t("login.mfa.sendCode")}
            </Button>
            {challengeId ? (
              <p className="text-center text-xs text-foreground-muted">{t("login.mfa.sentHint")}</p>
            ) : (
              <p className="text-center text-xs text-foreground-muted">{t("login.mfa.sendCodeHint")}</p>
            )}
          </div>
        ) : null}

        {factor ? (
          <>
            <Field>
              <FieldLabel htmlFor="mfa-code">{t("login.mfa.codeLabel")}</FieldLabel>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("login.mfa.codePlaceholder")}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 12))}
                disabled={busy}
                className="text-center tracking-widest"
              />
            </Field>

            {errorInfo ? (
              isEmailNotConfirmed(errorInfo) ? (
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
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-warning/30 bg-surface-base"
                    disabled={busy || resendEmailBusy}
                    onClick={() => void handleResendConfirmationEmail()}
                  >
                    {resendEmailBusy
                      ? t("login.emailConfirmation.resending")
                      : t("login.emailConfirmation.resend")}
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorInfo.message}
                </div>
              )
            ) : null}

            <Button type="submit" disabled={busy || !challengeId} className="w-full rounded-md">
              {busy ? t("login.mfa.verifying") : t("login.mfa.verify")}
            </Button>
          </>
        ) : null}

        {!factor && errorInfo ? (
          isEmailNotConfirmed(errorInfo) ? (
            <div
              className="flex flex-col gap-3 rounded-md border border-warning/20 bg-warning/10 p-4"
              role="alert"
            >
              <div className="flex gap-3">
                <Mail className="size-5 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-warning">{t("login.emailConfirmation.title")}</p>
                  <p className="text-sm text-warning">{errorInfo.message}</p>
                  <p className="text-xs text-warning">{t("login.emailConfirmation.hint")}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-warning/30 bg-surface-base"
                disabled={busy || resendEmailBusy}
                onClick={() => void handleResendConfirmationEmail()}
              >
                {resendEmailBusy
                  ? t("login.emailConfirmation.resending")
                  : t("login.emailConfirmation.resend")}
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorInfo.message}
            </div>
          )
        ) : null}

        <Button
          type="button"
          variant="ghost"
          className="w-full text-foreground-muted"
          disabled={busy}
          onClick={() => void onCancel()}
        >
          {t("login.mfa.cancelSignIn")}
        </Button>
      </form>
    </div>
  );
}
