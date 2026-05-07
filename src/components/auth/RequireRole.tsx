import { Navigate, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/stores/authStore";
import type { UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";

interface RequireRoleProps {
  children: React.ReactNode;
  /** Các role được phép truy cập */
  roles: readonly UserRole[];
  /** Redirect khi chưa đăng nhập (mặc định /login) */
  loginPath?: string;
  /** Redirect khi đã đăng nhập nhưng không đủ role (mặc định /) */
  fallbackPath?: string;
}

/**
 * Chỉ render children khi đã đăng nhập VÀ user có một trong các role cho phép.
 */
export function RequireRole({
  children,
  roles,
  loginPath = "/login",
  fallbackPath = "/",
}: RequireRoleProps) {
  const { t } = useTranslation("common");
  const { isAuthenticated, hasRole, authInitialized, profileLoading, profile, user, refreshProfile } =
    useAuth();
  const location = useLocation();

  if (!authInitialized) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (profileLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile && user) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground">{t("userProfile.errors.loadFailed")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refreshProfile(user)}>
          {t("actions.retry")}
        </Button>
      </div>
    );
  }

  if (!hasRole(roles)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
