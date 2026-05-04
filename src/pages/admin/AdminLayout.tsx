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
  const { titleKey, descriptionKey } = resolveAdminPageMeta(location.pathname);
  const metaTitle = t(titleKey as never);
  void t(descriptionKey as never);

  return (
    <SidebarProvider
      defaultOpen
      style={{ "--app-header-height": "2.75rem" } as React.CSSProperties}
    >
      <AdminSidebar />
      <SidebarInset>
        <div className="sticky top-0 z-30 border-b border-border-subtle bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
          <div className="flex h-11 items-center gap-2 px-3 md:px-4">
            <SidebarTrigger />
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
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
