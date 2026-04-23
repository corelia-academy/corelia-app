import { NavLink, Outlet, useLocation } from "react-router";
import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  GraduationCap,
  Pin,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";

function AdminSidebar() {
  const { t } = useTranslation("admin");
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <div className="px-3 pb-2 pt-3 transition-[padding] duration-200 ease-linear group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-1">
        <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/45 p-4 transition-[padding,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-1">
          <div className="flex items-start gap-3 transition-[gap] duration-200 ease-linear group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-[width,height,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:size-8">
              <Settings className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
                {t("layout.sidebar.brandTitle")}
              </div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-sidebar-foreground/72">
                {t("layout.sidebar.brandSubtitle")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("layout.sidebar.primaryNavigation")}</SidebarGroupLabel>
          <SidebarGroupContent className="px-1">
            <SidebarMenu className="gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip={t("layout.sidebar.users.tooltip")}
                  isActive={pathname === "/admin" || pathname.startsWith("/admin/users")}
                  render={
                    <NavLink to="/admin" end className="flex w-full items-center gap-2">
                      <Users className="size-4" aria-hidden />
                      <span>{t("layout.sidebar.users.label")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip="Dashboard"
                  isActive={pathname.startsWith("/admin/dashboard")}
                  render={
                    <NavLink
                      to="/admin/dashboard"
                      className="flex w-full items-center gap-2"
                    >
                      <Pin className="size-4" aria-hidden />
                      <span>{t("layout.sidebar.dashboard.label")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip={t("layout.sidebar.instructors.tooltip")}
                  isActive={pathname.startsWith("/admin/instructors")}
                  render={
                    <NavLink
                      to="/admin/instructors"
                      className="flex w-full items-center gap-2"
                    >
                      <GraduationCap className="size-4" aria-hidden />
                      <span>{t("layout.sidebar.instructors.label")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

const PAGE_META = [
  {
    match: (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/users"),
    titleKey: "layout.pageMeta.users.title",
    descriptionKey: "layout.pageMeta.users.description",
  },
  {
    match: (pathname: string) => pathname === "/admin/dashboard",
    titleKey: "layout.pageMeta.dashboard.title",
    descriptionKey: "layout.pageMeta.dashboard.description",
  },
  {
    match: (pathname: string) => pathname === "/admin/instructors",
    titleKey: "layout.pageMeta.instructors.title",
    descriptionKey: "layout.pageMeta.instructors.description",
  },
  {
    match: (pathname: string) => pathname.startsWith("/admin/instructors/"),
    titleKey: "layout.pageMeta.instructorDetail.title",
    descriptionKey: "layout.pageMeta.instructorDetail.description",
  },
];

export default function AdminLayout() {
  const { t } = useTranslation("admin");
  const location = useLocation();
  const currentMeta =
    PAGE_META.find((item) => item.match(location.pathname)) ?? PAGE_META[0];
  const metaTitle = t(currentMeta.titleKey as never);
  const metaDescription = t(currentMeta.descriptionKey as never);

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
            <div className="rounded-md border border-border-subtle bg-card/85 px-4 py-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("layout.hero.eyebrow")}
              </p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="text-2xl font-normal tracking-tight text-foreground">
                    {metaTitle}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-sm">
                    {metaDescription}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
                    {t("layout.hero.pills.sensitive")}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
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
