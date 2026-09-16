import { Outlet, useLocation } from "react-router";
import React from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminSidebar } from "@/features/admin/layout/AdminSidebar";
import { resolveAdminPageMeta } from "@/features/admin/layout/adminPageMeta";

export default function AdminLayout() {
  const { t } = useTranslation("admin");
  const location = useLocation();
  const isHackathonEditor =
    location.pathname === "/admin/hackathons/new" ||
    /^\/admin\/hackathons\/[^/]+\/edit$/.test(location.pathname);

  const [sidebarOpen, setSidebarOpen] = React.useState(
    () => !isHackathonEditor,
  );

  React.useEffect(() => {
    setSidebarOpen(!isHackathonEditor);
  }, [location.pathname, isHackathonEditor]);

  const { titleKey, descriptionKey, title, description } = resolveAdminPageMeta(location.pathname);
  const metaTitle = title ?? t(titleKey as never);
  void (description ?? t(descriptionKey as never));

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={{ "--app-header-height": "2.75rem" } as React.CSSProperties}
    >
      <AdminSidebar />
      <SidebarInset>
        <div className="sticky top-0 z-30 border-b border-border-subtle bg-surface-raised/90 backdrop-blur supports-backdrop-filter:bg-surface-raised/70">
          <div className="flex h-11 items-center gap-2 px-3 md:px-4">
            <SidebarTrigger />
            <div className="flex min-w-0 items-center gap-2 text-sm text-foreground-muted">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <span className="truncate">{metaTitle}</span>
            </div>
          </div>
        </div>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
