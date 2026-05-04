import { useMemo, useState } from "react";
import { useNavigate, NavLink, useLocation } from "react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MenuIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import { useOCAuth } from "@opencampus/ocid-connect-js";
import OpenCampusConnectDialog from "@/components/layouts/OpenCampusConnectDialog";
import { useTheme } from "next-themes";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, profile } = useAuth();
  const { t } = useTranslation("common");
  const { isInitialized, authState, ocAuth } = useOCAuth();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [ocConnectOpen, setOcConnectOpen] = useState(false);
  const [ocConnectLoading, setOcConnectLoading] = useState(false);
  const [ocConnectError, setOcConnectError] = useState<string | null>(null);

  const displayName = profile?.ocid
    ? profile.ocid
    : (profile?.full_name ??
      profile?.id?.slice(0, 8) ??
      t("user.fallbackName"));
  const isOcidConnected = Boolean(profile?.ocid);

  const ocConnectDisabled = useMemo(() => {
    if (!isInitialized) return true;
    if (!ocAuth) return true;
    return false;
  }, [isInitialized, ocAuth]);

  async function handleOcConnect() {
    setOcConnectError(null);
    try {
      if (ocConnectDisabled) return;
      setOcConnectLoading(true);
      await ocAuth!.signInWithRedirect({ state: "corelia-ocid-connect" });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : t("openCampusConnect.modal.startFailed");
      setOcConnectError(message);
      setOcConnectLoading(false);
    }
  }

  function handleOcLogoClick() {
    if (!isAuthenticated) return;
    if (isOcidConnected) {
      navigate("/account");
      return;
    }
    setOcConnectError(null);
    setOcConnectLoading(false);
    setOcConnectOpen(true);
  }

  return (
    <header className="sticky top-0 z-40 flex w-full border-b border-border-subtle bg-card/95 backdrop-blur-md supports-backdrop-filter:bg-card/90">
      <div className="mx-auto flex h-14 w-full max-w-[1990px] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="shrink-0 size-7">
            <MenuIcon className="size-5" aria-hidden />
          </SidebarTrigger>
          <NavLink
            to="/"
            className="flex h-10 items-center gap-2 text-sm font-medium"
          >
            <img
              src={
                isDarkMode
                  ? "/logo/corelia-logo-white.svg"
                  : "/logo/corelia-logo-black.svg"
              }
              alt="Corelia"
              className="h-9"
            />
          </NavLink>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/account")}
                className={`inline-flex h-9 items-center gap-2 rounded-full border border-border-subtle pr-2 text-left text-sm transition-colors hover:bg-muted/50 md:h-10 md:pr-3 ${
                  isOcidConnected
                    ? "bg-primary-container text-on-primary-container hover:bg-primary-container"
                    : "bg-card"
                } cursor-pointer`}
              >
                <Avatar className="size-9 md:size-10">
                  <AvatarImage
                    src={profile?.avatar_url ?? undefined}
                    alt={profile?.full_name ?? profile?.id?.slice(0, 8) ?? ""}
                  />
                  <AvatarFallback>
                    {(profile?.full_name ?? profile?.id ?? "U").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[180px] truncate md:inline">
                  {displayName}
                </span>
              </button>

              {!isOcidConnected && (
                <button
                  type="button"
                  onClick={handleOcLogoClick}
                  className="hidden h-10 items-center justify-center gap-2 rounded-full border border-border-subtle bg-[#141bec] px-2.5 py-2 text-left text-sm cursor-pointer md:inline-flex"
                  aria-label={t("openCampusConnect.header.ariaLabel")}
                >
                  <img
                    src="/logo/OC-square-logo.svg"
                    alt="Open Campus"
                    className="h-6 rounded-full"
                  />
                  <span className="text-white">
                    Link <span className="font-bold">OCID</span>
                  </span>
                </button>
              )}

              <OpenCampusConnectDialog
                open={ocConnectOpen}
                onOpenChange={setOcConnectOpen}
                onConnect={() => void handleOcConnect()}
                disabled={ocConnectDisabled}
                loading={ocConnectLoading}
                error={ocConnectError ?? authState?.error?.message ?? null}
              />
            </div>
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
