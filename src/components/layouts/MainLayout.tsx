import {
  BookOpen,
  CalendarDots,
  House,
  List,
  SignIn,
  Trophy,
} from "@phosphor-icons/react";
import React from "react";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import AppSidebar from "@/components/base/AppSidebar";
import { useAuth } from "@/stores/authStore";

const MainLayout = () => {
  const betaFeedbackUrl =
    import.meta.env.VITE_BETA_FEEDBACK_FORM_URL?.trim() || "";
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const mobilePrimaryNav = [
    { label: "Trang chủ", href: "/", icon: House, end: true },
    { label: "Khoá học", href: "/courses", icon: BookOpen },
    { label: "Lớp học", href: "/cohorts", icon: CalendarDots },
    { label: "Cuộc thi", href: "/contests", icon: Trophy },
    isAuthenticated
      ? { label: "Menu", href: "/menu", icon: List }
      : { label: "Đăng nhập", href: "/login", icon: SignIn },
  ] as const;

  return (
    <SidebarProvider
      defaultOpen
      style={{ "--app-header-height": "0rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="flex min-h-dvh flex-col">
        <main className="flex-1 pb-24 md:pb-0">
          <Outlet />
        </main>
        <footer className="hidden border-t border-border-subtle bg-card/70 md:block">
          <div className="container-app flex items-center justify-between gap-3 py-3 text-xs text-muted-foreground">
            <span>
              © {new Date().getFullYear()} Corelia Academy. Tất cả quyền được bảo
              lưu.
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
              return <MobileMenuTab key={item.href} icon={Icon} label={item.label} />;
            }
            if (item.href === "/login") {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => navigate("/login", { state: { from: location } })}
                  className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <Icon className="size-4 shrink-0" weight="duotone" />
                  <span className="line-clamp-1 text-[11px] leading-4">
                    {item.label}
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
                <Icon className="size-4 shrink-0" weight="duotone" />
                <span className="line-clamp-1 text-[11px] leading-4">
                  {item.label}
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

function MobileMenuTab({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; weight?: "duotone" | "fill" }>;
  label: string;
}) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      <Icon className="size-4 shrink-0" weight="duotone" />
      <span className="line-clamp-1 text-[11px] leading-4">{label}</span>
    </button>
  );
}
