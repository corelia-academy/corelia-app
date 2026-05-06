export type AuthErrorInfo = {
  message: string;
  code?: string;
};

type Translate = (key: string, options?: { defaultValue?: string }) => string;

function authCodeKey(code: string): string {
  return code.replaceAll("/", "__");
}

type SupabaseAuthErrorLike = {
  message: string;
  status?: number;
  code?: string;
  __isAuthError?: boolean;
};

function isSupabaseAuthError(e: unknown): e is SupabaseAuthErrorLike & { __isAuthError: true } {
  return (
    typeof e === "object" &&
    e !== null &&
    "__isAuthError" in e &&
    (e as { __isAuthError?: boolean }).__isAuthError === true &&
    typeof (e as { message?: unknown }).message === "string"
  );
}

/** Map Supabase Auth API `code` + `message` to auth/* pseudo-codes for i18n. */
function supabaseAuthToPseudoCode(err: {
  message: string;
  status?: number;
  code?: string;
}): string {
  const apiCode = err.code?.toLowerCase();
  if (apiCode === "email_not_confirmed") return "auth/email-not-confirmed";

  const msg = err.message.toLowerCase();
  if (
    msg.includes("mfa") ||
    msg.includes("multi-factor") ||
    msg.includes("second factor") ||
    msg.includes("authenticator") ||
    msg.includes("totp")
  ) {
    if (msg.includes("invalid") || msg.includes("wrong") || msg.includes("incorrect")) {
      return "auth/mfa-invalid-code";
    }
    return "auth/mfa-verification-failed";
  }
  if (msg.includes("captcha")) return "auth/captcha-failed";
  if (msg.includes("invalid login credentials")) return "auth/invalid-credential";
  if (msg.includes("email not confirmed")) return "auth/email-not-confirmed";
  if (msg.includes("user already registered")) return "auth/email-already-in-use";
  if (msg.includes("already registered")) return "auth/email-already-in-use";
  if (msg.includes("password") && msg.includes("least")) return "auth/weak-password";
  if (err.status === 429) return "auth/too-many-requests";
  if (msg.includes("signup is disabled")) return "auth/operation-not-allowed";
  if (
    msg.includes("identity is already linked") ||
    msg.includes("different provider")
  ) {
    return "auth/account-exists-with-different-credential";
  }
  return "auth/internal-error";
}

export function getAuthErrorInfo(
  err: unknown,
  translate?: Translate,
): AuthErrorInfo {
  if (isSupabaseAuthError(err)) {
    const code = supabaseAuthToPseudoCode({
      message: err.message,
      status: err.status,
      code: err.code,
    });
    const codeKey = `errors.${authCodeKey(code)}`;
    const translated = translate ? translate(codeKey, { defaultValue: "" }) : "";
    const translatedOrNull = translated || null;
    return {
      code,
      message:
        translatedOrNull ??
        err.message ??
        (translate
          ? translate("errors.generic", {
              defaultValue: "",
            })
          : "Something went wrong."),
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

export function isAccountExistsWithDifferentCredential(
  info: AuthErrorInfo | null,
): boolean {
  return info?.code === "auth/account-exists-with-different-credential";
}

export function isEmailNotConfirmed(info: AuthErrorInfo | null): boolean {
  return info?.code === "auth/email-not-confirmed";
}

/**
 * After `signUp`, GoTrue may return HTTP 200 with a user stub and `identities: []`
 * when the email is already registered (enumeration-resistant). A successful new
 * signup includes at least one identity (e.g. email provider).
 */
export function isDuplicateEmailSignUpResponse(user: {
  identities?: unknown[] | null;
} | null | undefined): boolean {
  if (!user) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}
