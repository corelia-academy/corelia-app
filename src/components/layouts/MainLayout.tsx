import {
  BookOpen,
  Home,
  List,
  LogIn,
  Trophy,
} from "lucide-react";
import React from "react";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
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
    { labelKey: "nav.contests" as const, href: "/contests", icon: Trophy },
    isAuthenticated
      ? { labelKey: "tabs.menu" as const, href: "/menu", icon: List }
      : { labelKey: "tabs.signIn" as const, href: "/login", icon: LogIn },
  ] as const;

  return (
    <SidebarProvider
      defaultOpen={false}
      style={{ "--app-header-height": "0rem" } as React.CSSProperties}
    >
      <MainSidebarOverlay />
      <SidebarInset className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1 pb-24 md:pb-0">
          <Outlet />
        </main>
        <footer className="hidden border-t border-border-subtle bg-card/70 md:block">
          <div className="container-app flex items-center justify-between gap-3 py-3 text-xs text-muted-foreground">
            <span>
              {t("footer.copyrightPrefix", { year: new Date().getFullYear() })}
            </span>
            {betaFeedbackUrl ? (
              <ReportIssueLink
                compact
                className="h-7 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
              />
            ) : (
              <span>corelia.academy</span>
            )}
          </div>
        </footer>
      </SidebarInset>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-card/95 backdrop-blur-md supports-backdrop-filter:bg-card/90 md:hidden">
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
                  className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
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
                  [
                    "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center transition-colors",
                    isActive
                      ? "bg-primary-container text-on-primary-container"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  ].join(" ")
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
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="line-clamp-1 text-xs leading-4">{label}</span>
    </button>
  );
}
