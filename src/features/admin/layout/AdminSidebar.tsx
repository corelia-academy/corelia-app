import { NavLink, useLocation } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Award, GraduationCap, ImageIcon, Medal, Pin, Settings, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AdminSidebar() {
  const { t } = useTranslation("admin");
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <div className="px-3 pb-2 pt-3 transition-[padding] duration-200 ease-linear group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-1">
        <div className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/45 p-4 transition-[padding,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:p-1">
          <div className="flex items-start gap-3 transition-[gap] duration-200 ease-linear group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground transition-[width,height,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:size-8">
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

      <SidebarSeparator className="mx-3 group-data-[collapsible=icon]:mx-1" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {t("layout.sidebar.primaryNavigation")}
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-1">
            <SidebarMenu className="gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-md"
                  tooltip={t("layout.sidebar.users.tooltip")}
                  isActive={
                    pathname === "/admin" || pathname.startsWith("/admin/users")
                  }
                  render={
                    <NavLink
                      to="/admin"
                      end
                      className="flex w-full items-center gap-2"
                    >
                      <Users className="size-4" aria-hidden />
                      <span>{t("layout.sidebar.users.label")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-md"
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
                  className="rounded-md"
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-md"
                  tooltip={t("layout.sidebar.activityMilestones.tooltip")}
                  isActive={pathname.startsWith("/admin/activity-milestones")}
                  render={
                    <NavLink
                      to="/admin/activity-milestones"
                      className="flex w-full items-center gap-2"
                    >
                      <Medal className="size-4" aria-hidden />
                      <span>{t("layout.sidebar.activityMilestones.label")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-md"
                  tooltip={t("layout.sidebar.branding.tooltip")}
                  isActive={pathname.startsWith("/admin/branding")}
                  render={
                    <NavLink
                      to="/admin/branding"
                      className="flex w-full items-center gap-2"
                    >
                      <ImageIcon className="size-4" aria-hidden />
                      <span>{t("layout.sidebar.branding.label")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-md"
                  tooltip={t("layout.sidebar.manualMint.tooltip")}
                  isActive={pathname.startsWith("/admin/manual-mint")}
                  render={
                    <NavLink
                      to="/admin/manual-mint"
                      className="flex w-full items-center gap-2"
                    >
                      <Award className="size-4" aria-hidden />
                      <span>{t("layout.sidebar.manualMint.label")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              {/* Hackathon management is no longer under /admin/* */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
