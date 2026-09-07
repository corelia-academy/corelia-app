import type { CSSProperties } from "react";
import { useAuth } from "@/stores/authStore";
import { isPublicPresentation } from "./publicPresentation";
import "@/styles/public-ui.css";
import { Outlet, useLocation } from "react-router";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import AppSidebar from "@/components/base/AppSidebar";
import Header from "./Header";

const MainLayout = () => {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const publicUI = isPublicPresentation(pathname, isAuthenticated);
  return (
    <SidebarProvider
      defaultOpen
      mobileBreakpoint={1024}
      className="public-ui flex-col"
      style={{ "--app-header-height": "4.75rem", "--sidebar-width": "14rem" } as CSSProperties}
    >
      <Header publicUI />
      <div className="flex min-h-0 flex-1">
        <MainAppSidebar />
        <SidebarInset className="flex min-h-[calc(100svh-var(--app-header-height))] min-w-0 flex-col">
          <div className={publicUI ? "public-content flex-1" : "flex-1"}>
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;

function MainAppSidebar() {
  const { isMobile } = useSidebar();

  return (
    <AppSidebar
      collapsible={isMobile ? "icon" : "none"}
      className="sticky top-(--app-header-height) h-[calc(100svh-var(--app-header-height))] self-start overflow-hidden border-r border-sidebar-border"
    />
  );
}
