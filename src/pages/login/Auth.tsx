import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, NavLink, useLocation, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
import { mfaAssuranceQueryOptions } from "@/features/auth/authQueries";
import { useAuth } from "@/stores/authStore";
import { LoginForm } from "@/pages/login/LoginForm";
import { LoginMfaChallenge } from "@/pages/login/components/LoginMfaChallenge";
import { LanguageSwitcher } from "@/components/base/LanguageSwitcher";
import { useTranslation } from "react-i18next";

/**
 * `unchecked` = đang chờ getAuthenticatorAssuranceLevel hoặc chưa có user.
 * Tránh redirect trước khi biết có cần MFA hay không.
 */
type MfaGateState = "unchecked" | "mfa" | "clear";

export default function Auth() {
  const { user, authInitialized, signOut } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation("common");
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";
  // Prefill from /claim's CTA link (?mode=signup&email=...).
  const initialEmail = searchParams.get("email")?.trim() || undefined;
  const initialMode = searchParams.get("mode") === "signup" ? "sign_up" : undefined;

  const [mfaCompletedForUser, setMfaCompletedForUser] = useState<string | null>(null);
  const assuranceQuery = useQuery(
    mfaAssuranceQueryOptions(user?.id, authInitialized && Boolean(user)),
  );
  const mfaGate: MfaGateState = !user
    ? "unchecked"
    : assuranceQuery.isPending
      ? "unchecked"
      : assuranceQuery.data?.currentLevel === "aal1" &&
          assuranceQuery.data.nextLevel === "aal2" &&
          mfaCompletedForUser !== user.id
        ? "mfa"
        : "clear";

  if (!authInitialized) {
    return (
      <div className="min-h-svh bg-auth-page">
        <AuthGateLoading minHeightClass="min-h-svh" />
      </div>
    );
  }

  if (user && mfaGate === "unchecked") {
    return (
      <div className="min-h-svh bg-auth-page">
        <AuthGateLoading minHeightClass="min-h-svh" />
      </div>
    );
  }

  if (user && mfaGate === "mfa") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-auth-page p-6 md:p-10">
        <div className="w-full max-w-sm md:max-w-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <NavLink
              to="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted transition-colors duration-150 hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              <span>{t("notFound.backHome")}</span>
            </NavLink>
            <LanguageSwitcher />
          </div>
          <LoginMfaChallenge
            onSuccess={() => setMfaCompletedForUser(user.id)}
            onCancel={async () => {
              await signOut();
              setMfaCompletedForUser(null);
            }}
          />
        </div>
      </div>
    );
  }

  if (user && mfaGate === "clear") {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-auth-page p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <NavLink
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>{t("notFound.backHome")}</span>
          </NavLink>
          <LanguageSwitcher />
        </div>
        <LoginForm initialEmail={initialEmail} initialMode={initialMode} />
      </div>
    </div>
  );
}
