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
import { auth, googleProvider, githubProvider } from "@/lib/firebase";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { WarningCircle } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

type AuthMode = "sign_in" | "sign_up";

function authCodeKey(code: string): string {
  return code.replaceAll("/", "__");
}

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

export type AuthErrorInfo = {
  message: string;
  code?: string;
};

type Translate = (key: string, options?: { defaultValue?: string }) => string;

function getAuthErrorInfo(err: unknown, translate?: Translate): AuthErrorInfo {
  if (isFirebaseAuthError(err)) {
    const codeKey = `errors.${authCodeKey(err.code)}`;
    const translated = translate ? translate(codeKey, { defaultValue: "" }) : "";
    const message = translated || null;
    return {
      code: err.code,
      message:
        message ??
        (err.message ||
          (translate
            ? translate("errors.generic", {
                defaultValue: "",
              })
            : "Something went wrong.")),
    };
  }
  if (err instanceof Error) return { message: err.message };
  if (typeof err === "string") return { message: err };
  return {
    message: translate
      ? translate("errors.generic", { defaultValue: "" })
      : "Something went wrong.",
  };
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

  const isAccountExistsError =
    errorInfo?.code === "auth/account-exists-with-different-credential";

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
                <p className="text-balance text-[15px] text-muted-foreground">
                  {subtitle}
                </p>
              </div>

              {mfaResolver ? (
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
                        onClick={() => void handleSendMfaCode()}
                      >
                        {loading ? t("login.mfa.sending") : t("login.mfa.sendCode")}
                      </Button>
                    </Field>
                  ) : (
                    <Field>
                      <p className="text-sm text-success">
                        {t("login.mfa.sentHint")}
                      </p>
                    </Field>
                  )}
                  <div className="space-y-4">
                    <Field>
                      <FieldLabel htmlFor="mfa-code">
                        {t("login.mfa.codeLabel")}
                      </FieldLabel>
                      <Input
                        id="mfa-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder={t("login.mfa.codePlaceholder")}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        className="font-mono text-lg tracking-widest"
                      />
                    </Field>
                    {errorInfo ? (
                      <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                        {errorInfo.message}
                      </div>
                    ) : null}
                    <Field className="flex gap-2">
                      <Button
                        type="button"
                        disabled={loading || !mfaVerificationId}
                        className="flex-1"
                        onClick={() => void handleConfirmMfa()}
                      >
                        {loading ? t("login.mfa.verifying") : t("login.mfa.verify")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearMfaStep}
                        disabled={loading}
                      >
                        Quay lại
                      </Button>
                    </Field>
                  </div>
                </>
              ) : showForgotPassword ? (
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
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>
                  {successMessage ? (
                    <div className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-[13px] text-success">
                      {successMessage}
                    </div>
                  ) : null}
                  {errorInfo ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                      {errorInfo.message}
                    </div>
                  ) : null}
                  <Field>
                    {successMessage ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-lg"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setSuccessMessage(null);
                        }}
                      >
                        {t("login.forgotPassword.backToSignIn")}
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg"
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
                      onClick={() => {
                        setShowForgotPassword(false);
                        setErrorInfo(null);
                        setSuccessMessage(null);
                      }}
                      className="font-medium underline underline-offset-2 text-muted-foreground hover:text-foreground"
                    >
                      {t("login.forgotPassword.backArrow")}
                    </button>
                  </FieldDescription>
                </>
              ) : (
                <>
                  {mode === "sign_up" && (
                    <Field>
                      <FieldLabel htmlFor="fullName">
                        {t("login.fields.fullName")}
                      </FieldLabel>
                      <Input
                        id="fullName"
                        type="text"
                        autoComplete="name"
                        placeholder={t("login.placeholders.fullName")}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </Field>
                  )}

                  <Field>
                    <FieldLabel htmlFor="email">{t("login.fields.email")}</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={t("login.placeholders.email")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">
                        {t("login.fields.password")}
                      </FieldLabel>
                      {mode === "sign_in" && (
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="ml-auto text-[13px] text-muted-foreground underline-offset-2 hover:underline"
                        >
                          {t("login.actions.forgotPassword")}
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={
                        mode === "sign_in" ? "current-password" : "new-password"
                      }
                      placeholder={t("login.placeholders.password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </Field>

                  {mode === "sign_up" && (
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
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </Field>
                  )}

                  {errorInfo ? (
                    isAccountExistsError ? (
                      <div
                        className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-950/30"
                        role="alert"
                      >
                        <WarningCircle
                          weight="fill"
                          className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
                        />
                        <div className="min-w-0 space-y-1">
                          <p className="text-[13px] font-medium text-amber-900 dark:text-amber-100">
                            {t("login.hints.accountExistsTitle")}
                          </p>
                          <p className="text-[13px] text-amber-800 dark:text-amber-200">
                            {errorInfo.message}
                          </p>
                          <p className="mt-1.5 text-[12px] text-amber-700 dark:text-amber-300">
                            {t("login.hints.accountExistsSuggestionPrefix")}{" "}
                            <strong>{t("login.hints.accountExistsEmailPassword")}</strong>{" "}
                            {t("login.hints.accountExistsSuggestionOrButton")}{" "}
                            <strong>Google</strong> / <strong>GitHub</strong>{" "}
                            {t("login.hints.accountExistsSuggestionSuffix")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                        {errorInfo.message}
                      </div>
                    )
                  ) : null}

                  <Field>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg"
                    >
                      {loading ? t("login.actions.processing") : title}
                    </Button>
                  </Field>

                  <FieldSeparator className="**:data-[slot=field-separator-content]:bg-card">
                    {t("login.actions.orContinueWith")}
                  </FieldSeparator>

                  <Field className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      type="button"
                      disabled={loading}
                      onClick={() => handleProvider(googleProvider)}
                      className="gap-2 rounded-lg"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="size-4"
                      >
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      <span>Google</span>
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      disabled={loading}
                      onClick={() => handleProvider(githubProvider)}
                      className="gap-2 rounded-lg"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="size-4"
                      >
                        <path
                          d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                          fill="currentColor"
                        />
                      </svg>
                      <span>GitHub</span>
                    </Button>
                  </Field>

                  <FieldDescription className="text-center">
                    {mode === "sign_in"
                      ? t("login.actions.newUser")
                      : t("login.actions.haveAccount")}
                    <button
                      type="button"
                      onClick={() => {
                        setMode((m) =>
                          m === "sign_in" ? "sign_up" : "sign_in",
                        );
                        setErrorInfo(null);
                        setConfirmPassword("");
                        setFullName("");
                      }}
                      disabled={loading}
                      className="font-medium underline underline-offset-2 disabled:opacity-50"
                    >
                      {mode === "sign_in"
                        ? t("login.actions.createAccount")
                        : t("login.actions.signIn")}
                    </button>
                  </FieldDescription>
                </>
              )}
            </FieldGroup>
          </form>

          <div className="relative hidden md:block">
            <img
              src="/Corelia_Banner_Square.png"
              alt="Corelia Banner"
              className="h-full w-full object-cover"
            />
          </div>
        </CardContent>
      </Card>

      <FieldDescription className="px-2 text-center text-[12px] text-muted-foreground">
        {t("login.terms.prefix")}
        <a
          href="https://corelia.academy/terms"
          className="underline underline-offset-2 hover:no-underline"
          target="_blank"
        >
          {t("login.terms.termsOfUse")}
        </a>{" "}
        {t("login.terms.and")}
        <a
          href="https://corelia.academy/policy"
          className="underline underline-offset-2 hover:no-underline"
          target="_blank"
        >
          {t("login.terms.privacyPolicy")}
        </a>
        {t("login.terms.suffix")}
      </FieldDescription>
    </div>
  );
}
