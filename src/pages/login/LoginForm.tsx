import { useEffect, useMemo, useRef, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import type { AuthProvider } from "firebase/auth";
import type { RecaptchaVerifier } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getMfaResolver,
  isPhoneFactorHint,
  sendSignInMfaSms,
  resolveSignInWithMfaSms,
  createRecaptchaVerifier,
} from "@/lib/mfa";
import type { MultiFactorResolver } from "@/lib/mfa";
import { setNewUserProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useTranslation } from "react-i18next";
import {
  getAuthErrorInfo,
  isAccountExistsWithDifferentCredential,
  type AuthErrorInfo,
} from "@/pages/login/loginErrors";
import { LoginBanner } from "@/pages/login/components/LoginBanner";
import { LoginEmailPasswordSection, type AuthMode } from "@/pages/login/components/LoginEmailPasswordSection";
import { LoginForgotPasswordSection } from "@/pages/login/components/LoginForgotPasswordSection";
import { LoginMfaSection } from "@/pages/login/components/LoginMfaSection";
import { LoginProviderButtons } from "@/pages/login/components/LoginProviderButtons";
import { LoginTerms } from "@/pages/login/components/LoginTerms";

type Translate = (key: string, options?: { defaultValue?: string }) => string;

function isFirebaseAuthError(
  e: unknown,
): e is { code: string; message?: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useTranslation("auth");
  const translate: Translate = (key, options) =>
    // `t` is strongly typed; wrap to allow dynamic keys (e.g. auth error codes).
    String(t(key as never, options as never));
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<AuthErrorInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(
    null,
  );
  const [mfaVerificationId, setMfaVerificationId] = useState<string | null>(
    null,
  );
  const [mfaCode, setMfaCode] = useState("");
  const mfaRecaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const title = useMemo(() => {
    if (mfaResolver) return t("login.title.mfa");
    if (showForgotPassword) return t("login.title.forgotPassword");
    return mode === "sign_in" ? t("login.title.signIn") : t("login.title.signUp");
  }, [mode, showForgotPassword, mfaResolver, t]);
  const subtitle = useMemo(() => {
    if (mfaResolver) return t("login.subtitle.mfa");
    if (showForgotPassword) return t("login.subtitle.forgotPassword");
    if (mode === "sign_in") return t("login.subtitle.signIn");
    return t("login.subtitle.signUp");
  }, [mode, showForgotPassword, mfaResolver, t]);

  useEffect(() => {
    if (!mfaResolver) return;
    const verifier = createRecaptchaVerifier(auth, "mfa-send-code-btn", {
      size: "invisible",
    });
    mfaRecaptchaRef.current = verifier;
    return () => {
      try {
        verifier.clear();
      } catch {
        // ignore
      }
      mfaRecaptchaRef.current = null;
    };
  }, [mfaResolver]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorInfo(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      if (showForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setSuccessMessage(
          t("login.forgotPassword.sent"),
        );
        return;
      }
      if (mode === "sign_in") {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (e: unknown) {
          const resolver = isFirebaseAuthError(e) ? getMfaResolver(auth, e) : null;
          if (resolver) {
            setMfaResolver(resolver);
            return;
          }
          throw e;
        }
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
        const { user } = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        await updateProfile(user, { displayName: name });
        await setNewUserProfile({
          full_name: name,
          email: user.email ?? undefined,
        });
      }
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
    } finally {
      setLoading(false);
    }
  }

  async function handleProvider(provider: AuthProvider) {
    setErrorInfo(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const resolver = isFirebaseAuthError(e) ? getMfaResolver(auth, e) : null;
      if (resolver) {
        setMfaResolver(resolver);
      } else {
        setErrorInfo(getAuthErrorInfo(e, translate));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMfaCode() {
    if (!mfaResolver || !mfaRecaptchaRef.current) return;
    setErrorInfo(null);
    setLoading(true);
    try {
      const firstPhoneIndex = mfaResolver.hints.findIndex(isPhoneFactorHint);
      if (firstPhoneIndex === -1) {
        setErrorInfo({
          message: t("login.mfa.smsOnly"),
        });
        return;
      }
      const vid = await sendSignInMfaSms(
        auth,
        mfaResolver,
        firstPhoneIndex,
        mfaRecaptchaRef.current,
      );
      setMfaVerificationId(vid);
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmMfa(e?: React.FormEvent) {
    e?.preventDefault();
    if (!mfaResolver || !mfaVerificationId || !mfaCode.trim()) {
      setErrorInfo({ message: t("login.mfa.needSendAndEnter") });
      return;
    }
    setErrorInfo(null);
    setLoading(true);
    try {
      await resolveSignInWithMfaSms(
        mfaResolver,
        mfaVerificationId,
        mfaCode.trim(),
      );
      setMfaResolver(null);
      setMfaVerificationId(null);
      setMfaCode("");
    } catch (e: unknown) {
      setErrorInfo(getAuthErrorInfo(e, translate));
    } finally {
      setLoading(false);
    }
  }

  function clearMfaStep() {
    setMfaResolver(null);
    setMfaVerificationId(null);
    setMfaCode("");
    setErrorInfo(null);
  }

  const isAccountExistsError = isAccountExistsWithDifferentCredential(errorInfo);

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
                <p className="text-balance text-sm text-muted-foreground">
                  {subtitle}
                </p>
              </div>

              {mfaResolver ? (
                <LoginMfaSection
                  loading={loading}
                  mfaVerificationId={mfaVerificationId}
                  mfaCode={mfaCode}
                  errorInfo={errorInfo}
                  onSendCode={() => void handleSendMfaCode()}
                  onCodeChange={setMfaCode}
                  onVerify={() => void handleConfirmMfa()}
                  onBack={clearMfaStep}
                />
              ) : showForgotPassword ? (
                <LoginForgotPasswordSection
                  email={email}
                  loading={loading}
                  errorInfo={errorInfo}
                  successMessage={successMessage}
                  onEmailChange={setEmail}
                  onBackToSignIn={() => {
                    setShowForgotPassword(false);
                    setSuccessMessage(null);
                  }}
                  onBackArrow={() => {
                    setShowForgotPassword(false);
                    setErrorInfo(null);
                    setSuccessMessage(null);
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
                    onEmailChange={setEmail}
                    onPasswordChange={setPassword}
                    onConfirmPasswordChange={setConfirmPassword}
                    onFullNameChange={setFullName}
                    onForgotPassword={() => setShowForgotPassword(true)}
                    onToggleMode={() => {
                      setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"));
                      setErrorInfo(null);
                      setConfirmPassword("");
                      setFullName("");
                    }}
                  />

                  <LoginProviderButtons
                    loading={loading}
                    onProvider={(provider) => void handleProvider(provider)}
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
