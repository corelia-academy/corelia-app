import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/stores/authStore";

interface RequireAuthProps {
  children: React.ReactNode;
  /** Redirect khi chưa đăng nhập (mặc định /login) */
  loginPath?: string;
}

/**
 * Chỉ render children khi đã đăng nhập; nếu chưa thì redirect về trang đăng nhập.
 */
export function RequireAuth({ children, loginPath = "/login" }: RequireAuthProps) {
  const { isAuthenticated, authInitialized } = useAuth();
  const location = useLocation();

  if (!authInitialized) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
