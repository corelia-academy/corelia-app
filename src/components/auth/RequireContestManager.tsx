import { Navigate, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
import { useAuth } from "@/stores/authStore";
import { canAccessContestManagementCatalog } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { hasHackathonCoOrganizerAccess } from "@/lib/hackathons";
import { useEffect, useState } from "react";

interface RequireContestManagerProps {
  children: React.ReactNode;
  /** Redirect khi chưa đăng nhập (mặc định /login) */
  loginPath?: string;
  /** Redirect khi không đủ quyền (mặc định /hackathons) */
  fallbackPath?: string;
}

/**
 * Cho phép: admin/support_staff + instructor (khu vực vận hành hackathon).
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
  const [coOrganizerAllowed, setCoOrganizerAllowed] = useState(false);
  const [checkingScoped, setCheckingScoped] = useState(false);
  const roleAllowed = canAccessContestManagementCatalog(profile);

  useEffect(() => {
    if (!authInitialized || !isAuthenticated || profileLoading) return;
    let cancelled = false;

    if (!profile?.email) {
      queueMicrotask(() => {
        if (cancelled) return;
        setCoOrganizerAllowed(false);
        setCheckingScoped(false);
      });
      return () => {
        cancelled = true;
      };
    }

    if (roleAllowed) {
      queueMicrotask(() => {
        if (cancelled) return;
        setCoOrganizerAllowed(true);
        setCheckingScoped(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setCheckingScoped(true);
    });
    void hasHackathonCoOrganizerAccess(profile.email)
      .then((ok) => {
        queueMicrotask(() => {
          if (cancelled) return;
          setCoOrganizerAllowed(ok);
        });
      })
      .finally(() => {
        queueMicrotask(() => {
          if (cancelled) return;
          setCheckingScoped(false);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [
    authInitialized,
    isAuthenticated,
    profileLoading,
    profile?.email,
    roleAllowed,
  ]);

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
        <p className="text-sm text-foreground-muted">{t("userProfile.errors.loadFailed")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refreshProfile(user)}>
          {t("actions.retry")}
        </Button>
      </div>
    );
  }

  if (checkingScoped) return <AuthGateLoading />;

  if (!roleAllowed && !coOrganizerAllowed) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}

