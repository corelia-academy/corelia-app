export type AuthErrorInfo = {
  message: string;
  code?: string;
};

type Translate = (key: string, options?: { defaultValue?: string }) => string;

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

export function getAuthErrorInfo(
  err: unknown,
  translate?: Translate,
): AuthErrorInfo {
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

export function isAccountExistsWithDifferentCredential(
  info: AuthErrorInfo | null,
): boolean {
  return info?.code === "auth/account-exists-with-different-credential";
}

