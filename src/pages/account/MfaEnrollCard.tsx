import { useEffect, useRef, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
} from "firebase/auth";
import { auth, githubProvider, googleProvider } from "@/lib/firebase";
import {
  createRecaptchaVerifier,
  enrollWithVerificationCode,
  getEnrolledFactorsDisplay,
  hasEnrolledFactors,
  sendEnrollMfaSms,
} from "@/lib/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

type MfaStep = "idle" | "reauth" | "phone" | "code";

export function MfaEnrollCard({ user }: { user: User }) {
  const { t } = useTranslation("account");
  const [step, setStep] = useState<MfaStep>("idle");
  const [reauthPassword, setReauthPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const recaptchaRef = useRef<ReturnType<typeof createRecaptchaVerifier> | null>(null);

  const hasPasswordProvider = user.providerData?.some(
    (p) => p.providerId === "password",
  );
  const enrolled = hasEnrolledFactors(user);
  const factorsDisplay = getEnrolledFactorsDisplay(user);

  /** Tạo (hoặc tái tạo) RecaptchaVerifier và gán vào ref. */
  function initRecaptcha() {
    try { recaptchaRef.current?.clear(); } catch { /* ignore */ }
    recaptchaRef.current = createRecaptchaVerifier(auth, "mfa-enroll-send-btn", {
      size: "invisible",
      // Khi token hết hạn (sau ~2 phút idle), reset verifier để lần gửi tiếp hoạt động.
      "expired-callback": () => { initRecaptcha(); },
    });
  }

  useEffect(() => {
    if (step !== "phone") return;
    initRecaptcha();
    return () => {
      try {
        recaptchaRef.current?.clear();
      } catch {
        // ignore
      }
      recaptchaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function onReauth() {
    setError(null);
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error(t("errors.notLoggedIn"));
      if (hasPasswordProvider && user.email) {
        const credential = EmailAuthProvider.credential(
          user.email,
          reauthPassword,
        );
        await reauthenticateWithCredential(currentUser, credential);
      } else {
        const provider = user.providerData?.some((p) => p.providerId === "google.com")
          ? googleProvider
          : githubProvider;
        await reauthenticateWithPopup(currentUser, provider);
      }
      setStep("phone");
      setReauthPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("mfa.errors.reauthFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function onSendCode() {
    if (!recaptchaRef.current || !auth.currentUser) return;
    setError(null);
    setLoading(true);
    try {
      let normalized = phone.replace(/\D/g, "");
      if (normalized.startsWith("0")) normalized = normalized.slice(1);
      if (normalized.length < 9) {
        setError(t("mfa.errors.invalidPhone"));
        return;
      }
      const withPlus = normalized.startsWith("84") ? `+${normalized}` : `+84${normalized}`;
      const vid = await sendEnrollMfaSms(
        auth,
        auth.currentUser,
        withPlus,
        recaptchaRef.current,
      );
      setVerificationId(vid);
      setStep("code");
    } catch (err) {
      // Token reCAPTCHA đã bị consume khi thất bại — phải tạo lại để lần gửi tiếp hoạt động.
      initRecaptcha();
      setError(
        err instanceof Error ? err.message : t("mfa.errors.sendCodeFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function onEnroll() {
    if (!verificationId || !auth.currentUser) return;
    setError(null);
    setLoading(true);
    try {
      await enrollWithVerificationCode(
        auth.currentUser,
        verificationId,
        code.trim(),
        t("mfa.factorLabel"),
      );
      setSuccess(t("mfa.success.enabled"));
      setStep("idle");
      setVerificationId(null);
      setCode("");
      setPhone("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("mfa.errors.enrollFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setStep("idle");
    setReauthPassword("");
    setPhone("");
    setVerificationId(null);
    setCode("");
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="space-y-4 rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <h2 className="text-base font-medium">{t("mfa.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("mfa.subtitle")}
      </p>

      {enrolled && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium text-muted-foreground">{t("mfa.enrolled.title")}</p>
          <ul className="mt-1 list-disc pl-4">
            {factorsDisplay.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {success && (
        <div className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === "idle" && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setStep("reauth")}
          disabled={loading}
        >
          {t("mfa.actions.addPhone")}
        </Button>
      )}

      {step === "reauth" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("mfa.reauth.hint")}
          </p>
          {hasPasswordProvider ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium" htmlFor="mfa-reauth-password">
                {t("mfa.reauth.passwordLabel")}
              </Label>
              <Input
                id="mfa-reauth-password"
                type="password"
                autoComplete="current-password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder={t("mfa.reauth.passwordPlaceholder")}
                className="rounded"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("mfa.reauth.popupHint", {
                provider: user.providerData?.some((p) => p.providerId === "google.com")
                  ? t("mfa.providers.google")
                  : t("mfa.providers.github"),
              })}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="default"
              disabled={loading}
              onClick={() => void onReauth()}
            >
              {loading ? t("common.loading") : t("common.continue")}
            </Button>
            <Button type="button" variant="outline" size="default" onClick={resetFlow}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {step === "phone" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor="mfa-enroll-phone">
              {t("mfa.phone.label")}
            </Label>
            <Input
              id="mfa-enroll-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("mfa.phone.placeholder")}
              className="rounded"
            />
          </div>
          <Button
            id="mfa-enroll-send-btn"
            type="button"
            className="w-full"
            size="lg"
            disabled={loading}
            onClick={() => void onSendCode()}
          >
            {loading ? t("mfa.actions.sending") : t("mfa.actions.sendSms")}
          </Button>
          <Button type="button" variant="outline" className="w-full" size="lg" onClick={resetFlow}>
            {t("common.cancel")}
          </Button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-3">
          <p className="text-sm text-success">{t("mfa.code.hint")}</p>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor="mfa-enroll-code">
              {t("mfa.code.label")}
            </Label>
            <Input
              id="mfa-enroll-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("mfa.code.placeholder")}
              maxLength={6}
              className="rounded font-mono text-lg tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              size="lg"
              disabled={loading || code.length < 6}
              onClick={() => void onEnroll()}
            >
              {loading ? t("common.loading") : t("common.finish")}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={resetFlow}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

