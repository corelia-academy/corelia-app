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
  const metaDescription = t(descriptionKey as never);

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
          <div className="px-3 pb-4 md:px-4">
            <div className="rounded-lg border border-border-subtle bg-card/85 p-6 shadow-card">
              <p className="text-xs font-medium text-muted-foreground">
                {t("layout.hero.eyebrow")}
              </p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {metaTitle}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {metaDescription}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground">
                    {t("layout.hero.pills.sensitive")}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground">
                    {t("layout.hero.pills.manualAudit")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
