import type { CSSProperties } from "react";
import { Outlet } from "react-router";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import AppSidebar from "@/components/base/AppSidebar";
import Header from "./Header";

const MainLayout = () => {
  return (
    <SidebarProvider
      defaultOpen
      mobileBreakpoint={1024}
      className="flex-col"
      style={{ "--app-header-height": "4.75rem" } as CSSProperties}
    >
      <Header />
      <div className="flex min-h-0 flex-1">
        <MainAppSidebar />
        <SidebarInset className="flex min-h-[calc(100svh-var(--app-header-height))] min-w-0 flex-col">
          <div className="flex-1">
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
      className="sticky top-(--app-header-height) h-[calc(100svh-var(--app-header-height))] self-start overflow-hidden"
    />
  );
}
