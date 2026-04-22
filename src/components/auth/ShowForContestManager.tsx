import { useAuth } from "@/stores/authStore";
import { canManageContests } from "@/lib/permissions";

interface ShowForContestManagerProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ShowForContestManager({
  children,
  fallback = null,
}: ShowForContestManagerProps) {
  const { isAuthenticated, profile } = useAuth();

  if (!isAuthenticated || !canManageContests(profile)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

