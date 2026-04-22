import { useAuth } from "@/stores/authStore";
import type { UserRole } from "@/types/database";

interface ShowForRoleProps {
  children: React.ReactNode;
  /** Chỉ hiển thị khi user có một trong các role này */
  roles: UserRole[];
  /** Render khi không đủ role (optional) */
  fallback?: React.ReactNode;
}

/**
 * Chỉ render children khi user đã đăng nhập và có một trong các role cho phép.
 * Dùng để show/hide UI theo role (ví dụ menu Admin chỉ cho admin).
 */
export function ShowForRole({ children, roles, fallback = null }: ShowForRoleProps) {
  const { isAuthenticated, hasRole } = useAuth();

  if (!isAuthenticated || !hasRole(roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
