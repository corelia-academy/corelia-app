import { useMemo } from "react";
import { NavLink, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { LanguageSwitcher } from "@/components/base/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

function supabaseOrigin(): string | null {
  const raw = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function isSafeConfirmationUrl(urlStr: string): boolean {
  const authOrigin = supabaseOrigin();
  if (!authOrigin) return false;
  try {
    const u = new URL(urlStr);
    return u.origin === authOrigin && u.pathname === "/auth/v1/verify";
  } catch {
    return false;
  }
}

function isAllowedRedirectTo(href: string): boolean {
  try {
    return new URL(href.trim()).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Token hash from signup confirmation emails (hex / opaque string from Supabase Auth). */
function isPlausibleTokenHash(token: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(token) && token.length >= 16;
}

function buildVerifyUrlFromParts(
  tokenHash: string,
  emailType: string,
  redirectTo: string | null,
): string | null {
  const raw = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!raw) return null;
  let base: string;
  try {
    base = new URL(raw).origin;
  } catch {
    return null;
  }
  const u = new URL(`${base}/auth/v1/verify`);
  u.searchParams.set("token", tokenHash);
  u.searchParams.set("type", emailType.trim() || "signup");
  if (redirectTo?.trim()) {
    const rt = redirectTo.trim();
    if (!isAllowedRedirectTo(rt)) return null;
    u.searchParams.set("redirect_to", rt);
  }
  return u.toString();
}

export default function ConfirmSignup() {
  const { t } = useTranslation("auth");
  const [searchParams] = useSearchParams();

  const targetVerifyUrl = useMemo(() => {
    const confirmationUrl = searchParams.get("confirmation_url");
    if (confirmationUrl?.trim()) {
      let decoded = confirmationUrl.trim();
      if (decoded.includes("%")) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch {
          return null;
        }
      }
      return isSafeConfirmationUrl(decoded) ? decoded : null;
    }

    const token = searchParams.get("token")?.trim() ?? "";
    const type = searchParams.get("type")?.trim() ?? "signup";
    const redirectTo = searchParams.get("redirect_to");

    if (!token || !isPlausibleTokenHash(token)) return null;
    return buildVerifyUrlFromParts(token, type, redirectTo);
  }, [searchParams]);

  const invalid = targetVerifyUrl === null;

  function confirmClick() {
    if (!targetVerifyUrl) return;
    window.location.assign(targetVerifyUrl);
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-auth-page p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <NavLink
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>{t("confirmSignup.backHome")}</span>
          </NavLink>
          <LanguageSwitcher />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {invalid ? t("confirmSignup.invalidTitle") : t("confirmSignup.title")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
            {invalid ? t("confirmSignup.invalidBody") : t("confirmSignup.body")}
          </p>

          {!invalid ? (
            <Button type="button" className="mt-6 w-full" size="lg" onClick={confirmClick}>
              {t("confirmSignup.confirmCta")}
            </Button>
          ) : null}

          <p className="mt-6 text-center text-sm">
            <NavLink to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("confirmSignup.backLogin")}
            </NavLink>
          </p>
        </div>
      </div>
    </div>
  );
}
