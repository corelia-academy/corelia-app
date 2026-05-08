import { Navigate, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
import { useAuth } from "@/stores/authStore";
import { canManageContests } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

interface RequireContestManagerProps {
  children: React.ReactNode;
  /** Redirect khi chưa đăng nhập (mặc định /login) */
  loginPath?: string;
  /** Redirect khi không đủ quyền (mặc định /hackathons) */
  fallbackPath?: string;
}

/**
 * Cho phép: admin, học vụ (support_staff), giảng viên nội bộ Corelia (instructor_origin=corelia).
 */
export function RequireContestManager({
  children,
  loginPath = "/login",
  fallbackPath = "/hackathons",
}: RequireContestManagerProps) {
  const { t } = useTranslation("common");
  const { isAuthenticated, authInitialized, profileLoading, profile, user, refreshProfile } =
    useAuth();
  const location = useLocation();

  if (!authInitialized) {
    return <AuthGateLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (profileLoading) {
    return <AuthGateLoading />;
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

  if (!canManageContests(profile)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}

