import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/stores/authStore";
import { canManageOfflineAcademy } from "@/lib/permissions";

interface RequireOfflineAcademyManagerProps {
  children: React.ReactNode;
  loginPath?: string;
  fallbackPath?: string;
}

export function RequireOfflineAcademyManager({
  children,
  loginPath = "/login",
  fallbackPath = "/cohorts",
}: RequireOfflineAcademyManagerProps) {
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

  if (!canManageOfflineAcademy(profile)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
