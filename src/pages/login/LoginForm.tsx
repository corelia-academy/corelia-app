import { useCallback, useMemo, useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { supabase } from "@/lib/supabase";
import { setNewUserProfileForUser } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useTranslation } from "react-i18next";
import {
  getAuthErrorInfo,
  isAccountExistsWithDifferentCredential,
  isDuplicateEmailSignUpResponse,
  isEmailNotConfirmed,
  type AuthErrorInfo,
} from "@/pages/login/loginErrors";
import { LoginBanner } from "@/pages/login/components/LoginBanner";
import { LoginEmailPasswordSection, type AuthMode } from "@/pages/login/components/LoginEmailPasswordSection";
import { LoginForgotPasswordSection } from "@/pages/login/components/LoginForgotPasswordSection";
import { LoginSignUpPendingSection } from "@/pages/login/components/LoginSignUpPendingSection";
import { LoginProviderButtons, type OAuthProviderId } from "@/pages/login/components/LoginProviderButtons";
import { LoginTerms } from "@/pages/login/components/LoginTerms";
import { passwordPolicyFailureReason } from "@/lib/passwordPolicy";
import { LoginHcaptcha } from "@/components/auth/LoginHcaptcha";
import { hcaptchaSiteKey, isHcaptchaConfigured } from "@/lib/hcaptchaConfig";
import { authMetadataLocaleFromUiLanguage } from "@/lib/intl";

type Translate = (key: string, options?: { defaultValue?: string }) => string;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t, i18n } = useTranslation("auth");
  const translate = useCallback<Translate>(
    (key, options) => String(t(key as never, options as never)),
    [t],
  );
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<AuthErrorInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailConfirmationSuccess, setEmailConfirmationSuccess] = useState<string | null>(null);
  const [resendConfirmationLoading, setResendConfirmationLoading] = useState(false);
  const [signUpAwaitingVerification, setSignUpAwaitingVerification] = useState<{
    email: string;
  } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const hcaptchaEnabled = useMemo(() => isHcaptchaConfigured(), []);
  const captchaRef = useRef<InstanceType<typeof HCaptcha> | null>(null);

  const resetCaptchaAfterAuth = useCallback(() => {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
  }, []);

  const captchaSlotKey = `${showForgotPassword}-${mode}`;
  const captchaBeforeSubmit = hcaptchaEnabled ? (
    <LoginHcaptcha
      key={captchaSlotKey}
      ref={captchaRef}
      sitekey={hcaptchaSiteKey()}
      onToken={setCaptchaToken}
      className="py-1"
    />
  ) : null;

  const title = useMemo(() => {
    if (showForgotPassword) return t("login.title.forgotPassword");
    if (signUpAwaitingVerification) return t("login.signUpAfterSubmit.title");
    return mode === "sign_in" ? t("login.title.signIn") : t("login.title.signUp");
  }, [mode, showForgotPassword, signUpAwaitingVerification, t]);

  const subtitle = useMemo(() => {
    if (showForgotPassword) return t("login.subtitle.forgotPassword");
    if (signUpAwaitingVerification) return t("login.signUpAfterSubmit.subtitle");
    if (mode === "sign_in") return t("login.subtitle.signIn");
    return t("login.subtitle.signUp");
  }, [mode, showForgotPassword, signUpAwaitingVerification, t]);

  const handleEmailChange = useCallback((next: string) => {
    setEmail(next);
    setEmailConfirmationSuccess(null);
  }, []);

  const handleResendConfirmationEmail = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) return;

    setErrorInfo(null);
    setEmailConfirmationSuccess(null);

    if (hcaptchaEnabled && !captchaToken?.trim()) {
      setErrorInfo({ message: t("errors.captchaRequired") });
      return;
    }

    const captchaOpts =
      hcaptchaEnabled && captchaToken ? { captchaToken: captchaToken.trim() } : {};

    setResendConfirmationLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
        ...(Object.keys(captchaOpts).length > 0 ? { options: captchaOpts } : {}),
      });
      if (error) throw error;
      setEmailConfirmationSuccess(t("login.emailConfirmation.resendSuccess"));
      resetCaptchaAfterAuth();
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
    } finally {
      setResendConfirmationLoading(false);
    }
  }, [
    captchaToken,
    email,
    hcaptchaEnabled,
    resetCaptchaAfterAuth,
    t,
    translate,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorInfo(null);
    setSuccessMessage(null);
    setEmailConfirmationSuccess(null);
    setSignUpAwaitingVerification(null);
    setLoading(true);
    let authApiCalled = false;
    try {
      if (hcaptchaEnabled && !captchaToken?.trim()) {
        setErrorInfo({ message: t("errors.captchaRequired") });
        return;
      }

      const captchaOpts =
        hcaptchaEnabled && captchaToken ? { captchaToken: captchaToken.trim() } : {};

      if (showForgotPassword) {
        authApiCalled = true;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/account/settings`,
          ...captchaOpts,
        });
        if (error) throw error;
        setSuccessMessage(t("login.forgotPassword.sent"));
        return;
      }
      if (mode === "sign_in") {
        authApiCalled = true;
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          ...(Object.keys(captchaOpts).length > 0 ? { options: captchaOpts } : {}),
        });
        if (error) throw error;
      } else {
        if (password !== confirmPassword) {
          setErrorInfo({ message: t("errors.passwordMismatch") });
          return;
        }
        const name = fullName.trim();
        if (!name) {
          setErrorInfo({ message: t("errors.missingFullName") });
          return;
        }
        const policyReason = passwordPolicyFailureReason(password);
        if (policyReason === "too_short") {
          setErrorInfo({ message: t("errors.passwordPolicyTooShort") });
          return;
        }
        if (policyReason === "missing_classes") {
          setErrorInfo({ message: t("errors.passwordPolicyMissingClasses") });
          return;
        }
        authApiCalled = true;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name,
              locale: authMetadataLocaleFromUiLanguage(i18n.resolvedLanguage ?? i18n.language),
            },
            ...captchaOpts,
          },
        });
        if (error) throw error;
        const session = data.session;
        const user = data.user;
        const trimmedEmail = email.trim();

        if (isDuplicateEmailSignUpResponse(user)) {
          const dupCode = "auth/email-already-in-use" as const;
          const msg = translate("errors.auth__email-already-in-use", {
            defaultValue: "",
          }).trim();
          setErrorInfo({
            code: dupCode,
            message: msg || translate("errors.generic", { defaultValue: "" }),
          });
          return;
        }

        if (session && user) {
          await setNewUserProfileForUser(user, {
            full_name: name,
            email: user.email ?? undefined,
          });
        } else {
          setSignUpAwaitingVerification({
            email: (user?.email ?? trimmedEmail).trim() || trimmedEmail,
          });
        }
      }
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
    } finally {
      setLoading(false);
      if (authApiCalled) {
        resetCaptchaAfterAuth();
      }
    }
  }

  async function handleProvider(provider: OAuthProviderId) {
    setErrorInfo(null);
    setEmailConfirmationSuccess(null);
    setSignUpAwaitingVerification(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
    } finally {
      setLoading(false);
    }
  }

  const isAccountExistsError = isAccountExistsWithDifferentCredential(errorInfo);
  const isEmailNotConfirmedError = isEmailNotConfirmed(errorInfo);

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      data-slot="login-form"
      {...props}
    >
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={(e) => void handleSubmit(e)} className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-normal tracking-tight text-foreground">
                  {title}
                </h1>
                <p className="text-balance text-sm text-foreground-muted">
                  {subtitle}
                </p>
              </div>

              {showForgotPassword ? (
                <LoginForgotPasswordSection
                  email={email}
                  loading={loading}
                  errorInfo={errorInfo}
                  successMessage={successMessage}
                  beforeSubmit={captchaBeforeSubmit}
                  onEmailChange={handleEmailChange}
                  onBackToSignIn={() => {
                    resetCaptchaAfterAuth();
                    setShowForgotPassword(false);
                    setSuccessMessage(null);
                    setSignUpAwaitingVerification(null);
                  }}
                  onBackArrow={() => {
                    resetCaptchaAfterAuth();
                    setShowForgotPassword(false);
                    setErrorInfo(null);
                    setSuccessMessage(null);
                    setSignUpAwaitingVerification(null);
                  }}
                />
              ) : signUpAwaitingVerification ? (
                <LoginSignUpPendingSection
                  email={signUpAwaitingVerification.email}
                  onBackToSignIn={() => {
                    resetCaptchaAfterAuth();
                    setSignUpAwaitingVerification(null);
                    setMode("sign_in");
                    setErrorInfo(null);
                    setPassword("");
                    setConfirmPassword("");
                    setFullName("");
                  }}
                />
              ) : (
                <>
                  <LoginEmailPasswordSection
                    mode={mode}
                    loading={loading}
                    title={title}
                    email={email}
                    password={password}
                    confirmPassword={confirmPassword}
                    fullName={fullName}
                    errorInfo={errorInfo}
                    isAccountExistsError={isAccountExistsError}
                    isEmailNotConfirmedError={isEmailNotConfirmedError}
                    onResendConfirmation={handleResendConfirmationEmail}
                    resendLoading={resendConfirmationLoading}
                    inlineSuccessMessage={emailConfirmationSuccess}
                    beforeSubmit={captchaBeforeSubmit}
                    onEmailChange={handleEmailChange}
                    onPasswordChange={setPassword}
                    onConfirmPasswordChange={setConfirmPassword}
                    onFullNameChange={setFullName}
                    onForgotPassword={() => {
                      resetCaptchaAfterAuth();
                      setEmailConfirmationSuccess(null);
                      setSignUpAwaitingVerification(null);
                      setShowForgotPassword(true);
                    }}
                    onToggleMode={() => {
                      resetCaptchaAfterAuth();
                      setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"));
                      setErrorInfo(null);
                      setEmailConfirmationSuccess(null);
                      setSignUpAwaitingVerification(null);
                      setConfirmPassword("");
                      setFullName("");
                    }}
                  />

                  <LoginProviderButtons
                    loading={loading}
                    onProvider={(p) => void handleProvider(p)}
                  />
                </>
              )}
            </FieldGroup>
          </form>

          <LoginBanner />
        </CardContent>
      </Card>

      <LoginTerms />
    </div>
  );
}
