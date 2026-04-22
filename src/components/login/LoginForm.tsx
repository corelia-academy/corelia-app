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

type AuthMode = "sign_in" | "sign_up";

/**
 * Firebase Auth (Client/Web SDK) – mã lỗi user có thể gặp khi đăng nhập/đăng ký/quên mật khẩu.
 * Tham khảo: https://firebase.google.com/docs/reference/js/auth#autherrorcodes
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.",
  "auth/user-not-found": "Email hoặc mật khẩu không đúng.",
  "auth/wrong-password": "Email hoặc mật khẩu không đúng.",
  "auth/invalid-credential":
    "Email hoặc mật khẩu không đúng. Vui lòng thử lại.",
  "auth/invalid-login-credentials":
    "Email hoặc mật khẩu không đúng. Vui lòng thử lại.",
  "auth/email-already-in-use":
    "Email này đã được sử dụng cho tài khoản khác. Vui lòng đăng nhập hoặc dùng email khác.",
  "auth/weak-password":
    "Mật khẩu quá yếu. Vui lòng chọn mật khẩu có ít nhất 6 ký tự.",
  "auth/operation-not-allowed":
    "Phương thức đăng nhập này chưa được bật. Vui lòng liên hệ quản trị viên.",
  "auth/user-disabled":
    "Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
  "auth/account-exists-with-different-credential":
    "Email này đã được đăng ký bằng cách đăng nhập khác (Email/Mật khẩu, Google hoặc GitHub). Vui lòng dùng đúng cách bạn đã chọn khi đăng ký.",
  "auth/popup-blocked":
    "Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng cho phép popup cho trang này và thử lại.",
  "auth/popup-closed-by-user":
    "Bạn đã đóng cửa sổ đăng nhập. Vui lòng thử lại.",
  "auth/cancelled-popup-request":
    "Đã mở một cửa sổ đăng nhập khác. Vui lòng thử lại.",
  "auth/unauthorized-domain":
    "Tên miền này chưa được phép đăng nhập. Vui lòng liên hệ quản trị viên.",
  "auth/invalid-action-code":
    "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại email đặt lại mật khẩu.",
  "auth/expired-action-code":
    "Link đặt lại mật khẩu đã hết hạn. Vui lòng gửi lại email đặt lại mật khẩu.",
  "auth/user-mismatch":
    "Thông tin xác thực không khớp với tài khoản. Vui lòng thử lại.",
  "auth/too-many-requests":
    'Quá nhiều lần thử. Vui lòng thử lại sau vài phút hoặc dùng chức năng "Quên mật khẩu".',
  "auth/requires-recent-login":
    "Vì lý do bảo mật, vui lòng đăng nhập lại rồi thực hiện thao tác.",
  "auth/multi-factor-auth-required":
    "Tài khoản bật xác thực hai yếu tố. Vui lòng nhập mã SMS.",
  "auth/network-request-failed":
    "Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.",
  "auth/internal-error": "Đã xảy ra lỗi từ dịch vụ. Vui lòng thử lại sau.",
  "auth/app-deleted": "Ứng dụng tạm thời không khả dụng. Vui lòng thử lại sau.",
  "auth/app-not-authorized":
    "Ứng dụng chưa được cấu hình đúng. Vui lòng liên hệ quản trị viên.",
  "auth/invalid-api-key":
    "Cấu hình ứng dụng lỗi. Vui lòng liên hệ quản trị viên.",
  "auth/web-storage-unsupported":
    "Trình duyệt không hỗ trợ lưu phiên đăng nhập. Vui lòng bật cookie/dữ liệu trang web hoặc thử trình duyệt khác.",
};

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

function getAuthErrorInfo(err: unknown): AuthErrorInfo {
  if (isFirebaseAuthError(err)) {
    const message = AUTH_ERROR_MESSAGES[err.code];
    return {
      code: err.code,
      message: message ?? (err.message || "Có lỗi xảy ra. Vui lòng thử lại."),
    };
  }
  if (err instanceof Error) return { message: err.message };
  if (typeof err === "string") return { message: err };
  return { message: "Có lỗi xảy ra. Vui lòng thử lại." };
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
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
    if (mfaResolver) return "Xác thực bước 2";
    if (showForgotPassword) return "Đặt lại mật khẩu";
    return mode === "sign_in" ? "Đăng nhập" : "Tạo tài khoản";
  }, [mode, showForgotPassword, mfaResolver]);
  const subtitle = useMemo(() => {
    if (mfaResolver)
      return "Nhập mã SMS đã gửi đến số điện thoại đăng ký của bạn.";
    if (showForgotPassword)
      return "Nhập email đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.";
    if (mode === "sign_in") return "Đăng nhập bằng email và mật khẩu.";
    return "Tạo tài khoản mới để bắt đầu học.";
  }, [mode, showForgotPassword, mfaResolver]);

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
          "Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (và thư mục spam).",
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
          setErrorInfo({ message: "Mật khẩu xác nhận không khớp." });
          return;
        }
        const name = fullName.trim();
        if (!name) {
          setErrorInfo({ message: "Vui lòng nhập họ tên." });
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
      setErrorInfo(getAuthErrorInfo(e));
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
        setErrorInfo(getAuthErrorInfo(e));
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
          message: "Chỉ hỗ trợ xác thực bằng SMS. Vui lòng liên hệ quản trị viên.",
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
      setErrorInfo(getAuthErrorInfo(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmMfa(e?: React.FormEvent) {
    e?.preventDefault();
    if (!mfaResolver || !mfaVerificationId || !mfaCode.trim()) {
      setErrorInfo({ message: "Vui lòng bấm 'Gửi mã' rồi nhập mã SMS." });
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
      setErrorInfo(getAuthErrorInfo(e));
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
                        Bấm &quot;Gửi mã&quot; để nhận mã SMS đến số điện thoại đã đăng ký.
                      </p>
                      <Button
                        id="mfa-send-code-btn"
                        type="button"
                        disabled={loading}
                        className="mt-2 w-full"
                        onClick={() => void handleSendMfaCode()}
                      >
                        {loading ? "Đang gửi…" : "Gửi mã"}
                      </Button>
                    </Field>
                  ) : (
                    <Field>
                      <p className="text-sm text-success">
                        Mã đã gửi. Nhập mã vào ô bên dưới.
                      </p>
                    </Field>
                  )}
                  <div className="space-y-4">
                    <Field>
                      <FieldLabel htmlFor="mfa-code">Mã xác thực (6 số)</FieldLabel>
                      <Input
                        id="mfa-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
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
                        {loading ? "Đang xác thực…" : "Xác nhận"}
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
                        Quay lại đăng nhập
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg"
                      >
                        {loading ? "Đang gửi…" : "Gửi link đặt lại mật khẩu"}
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
                      ← Quay lại đăng nhập
                    </button>
                  </FieldDescription>
                </>
              ) : (
                <>
                  {mode === "sign_up" && (
                    <Field>
                      <FieldLabel htmlFor="fullName">Họ và tên</FieldLabel>
                      <Input
                        id="fullName"
                        type="text"
                        autoComplete="name"
                        placeholder="Nguyễn Văn A"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </Field>
                  )}

                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="ban@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Mật khẩu</FieldLabel>
                      {mode === "sign_in" && (
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="ml-auto text-[13px] text-muted-foreground underline-offset-2 hover:underline"
                        >
                          Quên mật khẩu?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={
                        mode === "sign_in" ? "current-password" : "new-password"
                      }
                      placeholder="Tối thiểu 6 ký tự"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </Field>

                  {mode === "sign_up" && (
                    <Field>
                      <FieldLabel htmlFor="confirmPassword">
                        Xác nhận mật khẩu
                      </FieldLabel>
                      <Input
                        id="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Nhập lại mật khẩu"
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
                            Tài khoản đã tồn tại với cách đăng nhập khác
                          </p>
                          <p className="text-[13px] text-amber-800 dark:text-amber-200">
                            {errorInfo.message}
                          </p>
                          <p className="mt-1.5 text-[12px] text-amber-700 dark:text-amber-300">
                            Gợi ý: thử đăng nhập bằng{" "}
                            <strong>Email & Mật khẩu</strong> hoặc nút{" "}
                            <strong>Google</strong> / <strong>GitHub</strong>{" "}
                            tương ứng với lần đầu bạn đăng ký.
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
                      {loading ? "Đang xử lý…" : title}
                    </Button>
                  </Field>

                  <FieldSeparator className="**:data-[slot=field-separator-content]:bg-card">
                    Hoặc tiếp tục với
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
                      ? "Bạn mới dùng? "
                      : "Đã có tài khoản? "}
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
                      {mode === "sign_in" ? "Tạo tài khoản" : "Đăng nhập"}
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
        Bằng việc tiếp tục, bạn đồng ý với{" "}
        <a
          href="https://corelia.academy/terms"
          className="underline underline-offset-2 hover:no-underline"
          target="_blank"
        >
          Điều khoản sử dụng
        </a>{" "}
        và{" "}
        <a
          href="https://corelia.academy/policy"
          className="underline underline-offset-2 hover:no-underline"
          target="_blank"
        >
          Chính sách bảo mật
        </a>
        .
      </FieldDescription>
    </div>
  );
}
