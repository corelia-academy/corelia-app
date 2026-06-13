import { Navigate, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";

interface RequireAuthenticatedProps {
  children: React.ReactNode;
  loginPath?: string;
}

export function RequireAuthenticated({
  children,
  loginPath = "/login",
}: RequireAuthenticatedProps) {
  const { t } = useTranslation("common");
  const {
    authInitialized,
    isAuthenticated,
    profileLoading,
    profile,
    user,
    refreshProfile,
  } = useAuth();
  const location = useLocation();

  if (!authInitialized || profileLoading) {
    return <AuthGateLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (!profile && user) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-foreground-muted">
          {t("userProfile.errors.loadFailed")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refreshProfile(user)}
        >
          {t("actions.retry")}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
