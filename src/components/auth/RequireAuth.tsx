import { Navigate, useLocation } from "react-router";
import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
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
    return <AuthGateLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
