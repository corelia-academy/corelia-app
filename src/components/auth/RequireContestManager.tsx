import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/stores/authStore";
import { canManageContests } from "@/lib/permissions";

interface RequireContestManagerProps {
  children: React.ReactNode;
  /** Redirect khi chưa đăng nhập (mặc định /login) */
  loginPath?: string;
  /** Redirect khi không đủ quyền (mặc định /contests) */
  fallbackPath?: string;
}

/**
 * Cho phép: admin, học vụ (support_staff), giảng viên nội bộ Corelia (instructor_origin=corelia).
 */
export function RequireContestManager({
  children,
  loginPath = "/login",
  fallbackPath = "/contests",
}: RequireContestManagerProps) {
  const { isAuthenticated, authInitialized, loading, profile } = useAuth();
  const location = useLocation();

  if (!authInitialized || loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (!canManageContests(profile)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}

