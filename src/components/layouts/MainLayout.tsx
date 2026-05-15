import { Briefcase, BookOpen, Home, List, LogIn, Trophy } from "lucide-react";
import React, { Suspense, lazy } from "react";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import AppSidebar from "@/components/base/AppSidebar";
import { useAuth } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Header from "./Header";

const GlobalCoraAssistant = lazy(() =>
  import("@/components/course-ai/GlobalCoraAssistant").then((module) => ({
    default: module.GlobalCoraAssistant,
  })),
);

const mobileTabItemClassName =
  "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-center transition-colors";

const MainLayout = () => {
  const { t } = useTranslation("common");
  const betaFeedbackUrl =
    import.meta.env.VITE_BETA_FEEDBACK_FORM_URL?.trim() || "";
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const mobilePrimaryNav = [
    { labelKey: "nav.home" as const, href: "/", icon: Home, end: true },
    { labelKey: "nav.courses" as const, href: "/courses", icon: BookOpen },
    { labelKey: "nav.career" as const, href: "/career", icon: Briefcase },
    { labelKey: "nav.contests" as const, href: "/hackathons", icon: Trophy },
    isAuthenticated
      ? { labelKey: "tabs.menu" as const, href: "/menu", icon: List }
      : { labelKey: "tabs.signIn" as const, href: "/login", icon: LogIn },
  ] as const;

  return (
    <SidebarProvider defaultOpen={false}>
      <MainSidebarOverlay />
      <SidebarInset className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <Outlet />
        </main>
        <Suspense fallback={null}>
          <GlobalCoraAssistant />
        </Suspense>
        <footer className="hidden border-t border-border-subtle bg-surface-raised md:block">
          <div className="container-app flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 text-xs text-foreground-muted">
            <span className="min-w-0">
              {t("footer.copyrightPrefix", { year: new Date().getFullYear() })}
            </span>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
              <NavLink
                to="/roadmap"
                className={({ isActive }) =>
                  cn(
                    "inline-flex h-7 shrink-0 items-center justify-center rounded-full px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-surface-overlay text-foreground"
                      : "text-foreground-muted hover:bg-surface-overlay hover:text-foreground",
                  )
                }
              >
                {t("footer.roadmap")}
              </NavLink>

              {betaFeedbackUrl ? (
                <ReportIssueLink
                  compact
                  className="h-7 shrink-0 rounded-full px-2.5 text-xs text-foreground-muted hover:text-foreground"
                />
              ) : (
                <span className="shrink-0">corelia.academy</span>
              )}

              <span className="shrink-0 tabular-nums text-foreground-muted">
                {t("footer.version", {
                  version: import.meta.env.VITE_APP_VERSION,
                })}
              </span>
            </div>
          </div>
        </footer>
      </SidebarInset>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-float pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        <div className="container-app grid grid-cols-5 gap-1 px-2 py-2">
          {mobilePrimaryNav.map((item) => {
            const Icon = item.icon;
            if (item.href === "/menu") {
              return (
                <MobileMenuTab
                  key={item.href}
                  icon={Icon}
                  label={t(item.labelKey)}
                />
              );
            }
            if (item.href === "/login") {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() =>
                    navigate("/login", { state: { from: location } })
                  }
                  className={cn(
                    mobileTabItemClassName,
                    "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="line-clamp-1 text-xs leading-4">
                    {t(item.labelKey)}
                  </span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={"end" in item ? item.end : undefined}
                className={({ isActive }) =>
                  cn(
                    mobileTabItemClassName,
                    isActive
                      ? "bg-primary-muted text-primary"
                      : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="line-clamp-1 text-xs leading-4">
                  {t(item.labelKey)}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;

function MainSidebarOverlay() {
  const { isMobile, open, setOpen } = useSidebar();

  if (isMobile) {
    // Mobile is already rendered as a Sheet by the Sidebar component.
    return <AppSidebar />;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="w-76 bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Sidebar</SheetTitle>
        </SheetHeader>
        <div className="h-full">
          <AppSidebar collapsible="none" showDesktopTrigger={false} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileMenuTab({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const { toggleSidebar, openMobile } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-expanded={openMobile}
      aria-controls="app-sidebar-mobile"
      className={cn(
        mobileTabItemClassName,
        "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="line-clamp-1 text-xs leading-4">{label}</span>
    </button>
  );
}
