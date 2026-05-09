import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, NavLink, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
import { supabase } from "@/lib/supabase";
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
  const { t } = useTranslation("common");
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const [mfaGate, setMfaGate] = useState<MfaGateState>("unchecked");
  const prevUserIdRef = useRef<string | undefined>(undefined);

  // Reset MFA gate when Supabase user identity changes (login/logout/switch account).
  /* eslint-disable react-hooks/set-state-in-effect -- synchronous gate reset before AAL fetch avoids Navigate flash */
  useLayoutEffect(() => {
    const id = user?.id;
    if (prevUserIdRef.current === id) return;
    prevUserIdRef.current = id;
    setMfaGate("unchecked");
  }, [user?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!user?.id || !authInitialized) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (error) {
        console.error("[Auth] getAuthenticatorAssuranceLevel:", error.message);
        setMfaGate("clear");
        return;
      }
      if (data.currentLevel === "aal1" && data.nextLevel === "aal2") {
        setMfaGate("mfa");
      } else {
        setMfaGate("clear");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authInitialized]);

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
            onSuccess={() => setMfaGate("clear")}
            onCancel={async () => {
              await signOut();
              setMfaGate("unchecked");
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
        <LoginForm />
      </div>
    </div>
  );
}
