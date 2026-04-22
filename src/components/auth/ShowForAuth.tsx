import type { ReactNode } from "react";
import { useAuth } from "@/stores/authStore";

interface ShowForAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ShowForAuth({ children, fallback = null }: ShowForAuthProps) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <>{fallback}</>;
}

