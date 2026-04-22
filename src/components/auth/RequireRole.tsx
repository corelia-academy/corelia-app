import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/stores/authStore";
import type { UserRole } from "@/types/database";

interface RequireRoleProps {
  children: React.ReactNode;
  /** Các role được phép truy cập */
  roles: UserRole[];
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
  const { isAuthenticated, hasRole, authInitialized, loading } = useAuth();
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

  if (!hasRole(roles)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
