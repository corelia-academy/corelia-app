import { useNavigate, NavLink, useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MenuIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/stores/authStore";
import { useTranslation } from "react-i18next";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, profile } = useAuth();
  const { t } = useTranslation("common");

  const displayName = profile?.ocid
    ? profile.ocid
    : profile?.full_name ?? profile?.id?.slice(0, 8) ?? t("user.fallbackName");
  const isOcidConnected = Boolean(profile?.ocid);

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border-subtle bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/65 md:block">
      <div className="flex h-12 items-center justify-between gap-3 p-4 bg-white dark:bg-black">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="shrink-0">
            <MenuIcon className="size-4" aria-hidden />
          </SidebarTrigger>
          <NavLink
            to="/"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <img src="/corelia_favicon.svg" alt="Corelia" className="size-5" />
            <span className="text-foreground">Corelia</span>
          </NavLink>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => navigate("/account")}
              className="inline-flex items-center gap-2 rounded-full border border-border-subtle pr-2 text-left text-sm shadow-card transition-colors hover:bg-card"
              style={
                isOcidConnected
                  ? ({ backgroundColor: "#00eebf" } as React.CSSProperties)
                  : undefined
              }
            >
              <Avatar>
                <AvatarImage
                  src={profile?.avatar_url ?? undefined}
                  alt={profile?.full_name ?? profile?.id?.slice(0, 8) ?? ""}
                />
                <AvatarFallback>
                  {(profile?.full_name ?? profile?.id ?? "U").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span
                className="max-w-[180px] truncate"
                style={
                  isOcidConnected
                    ? ({ color: "#141bec" } as React.CSSProperties)
                    : undefined
                }
              >
                {displayName}
              </span>
            </button>
          ) : (
            <NavLink
              to="/login"
              state={{ from: location }}
              className="inline-flex items-center rounded-full border border-border-subtle bg-card/70 px-3 py-1.5 text-sm text-foreground shadow-card transition-colors hover:bg-card"
            >
              {t("tabs.signIn")}
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
