import { NavLink, useLocation } from "react-router";
import {
  BookOpen,
  GraduationCap,
  Home,
  MapPinned,
  Medal,
  Settings,
  Trophy,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ShowForRole } from "@/components/auth/ShowForRole";
import { ShowForAuth } from "@/components/auth/ShowForAuth";
import { useTranslation } from "react-i18next";
import { ROLE_GROUPS } from "@/config/roles";

const primaryNav = [
  { labelKey: "nav.home" as const, href: "/", icon: Home, end: true },
  { labelKey: "nav.courses" as const, href: "/courses", icon: BookOpen },
  { labelKey: "nav.contests" as const, href: "/contests", icon: Trophy },
] as const;

export default function AppSidebar({
  collapsible = "icon",
  showDesktopTrigger = true,
}: {
  collapsible?: "offcanvas" | "icon" | "none";
  showDesktopTrigger?: boolean;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const pathname = location.pathname;
  const { isMobile } = useSidebar();

  return (
    <Sidebar collapsible={collapsible} variant="sidebar">
      <SidebarHeader className="p-2">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <NavLink
            to="/"
            className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1"
          >
            <img src="/corelia_favicon.svg" alt="Corelia" className="size-6" />
            <span className="truncate group-data-[collapsible=icon]:hidden">
              Corelia
            </span>
          </NavLink>

          {showDesktopTrigger ? (
            <div className="hidden group-data-[collapsible=icon]:hidden md:block">
              <SidebarTrigger />
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-1">
            <SidebarMenu className="gap-1">
              {!isMobile
                ? primaryNav.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          className="rounded-md"
                          tooltip={t(item.labelKey)}
                          isActive={isActive}
                          render={
                            <NavLink
                              to={item.href}
                              end={"end" in item ? item.end : undefined}
                              className="flex w-full items-center gap-2"
                            >
                              <Icon className="size-5 shrink-0" aria-hidden />
                              <span>{t(item.labelKey)}</span>
                            </NavLink>
                          }
                        />
                      </SidebarMenuItem>
                    );
                  })
                : null}

              <SidebarMenuItem key="/roadmap">
                <SidebarMenuButton
                  className="rounded-md"
                  tooltip={t("nav.roadmap")}
                  isActive={
                    pathname === "/roadmap" ||
                    pathname.startsWith("/roadmap/")
                  }
                  render={
                    <NavLink
                      to="/roadmap"
                      className="flex w-full items-center gap-2"
                    >
                      <MapPinned className="size-5 shrink-0" aria-hidden />
                      <span>{t("nav.roadmap")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>

              <ShowForAuth>
                <SidebarMenuItem key="/achievements">
                  <SidebarMenuButton
                    className="rounded-md"
                    tooltip={t("nav.achievements")}
                    isActive={pathname.startsWith("/achievements")}
                    render={
                      <NavLink
                        to="/achievements"
                        className="flex w-full items-center gap-2"
                      >
                        <Medal className="size-5 shrink-0" aria-hidden />
                        <span>{t("nav.achievements")}</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              </ShowForAuth>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mt-1" />

        <SidebarGroup>
          <SidebarGroupContent className="px-1">
            <SidebarMenu className="gap-1">
              <ShowForRole roles={ROLE_GROUPS.instructorWorkspace}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="rounded-md"
                    tooltip={t("nav.instructorManagement")}
                    isActive={pathname.startsWith("/instructor")}
                    render={
                      <NavLink
                        to="/instructor/courses"
                        className="flex w-full items-center gap-2"
                      >
                        <GraduationCap className="size-5 shrink-0" aria-hidden />
                        <span>{t("nav.instructor")}</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              </ShowForRole>
              <ShowForRole roles={ROLE_GROUPS.admin}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="rounded-md"
                    tooltip={t("nav.admin")}
                    isActive={pathname.startsWith("/admin")}
                    render={
                      <NavLink
                        to="/admin"
                        className="flex w-full items-center gap-2"
                      >
                        <Settings className="size-5 shrink-0" aria-hidden />
                        <span>{t("nav.admin")}</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              </ShowForRole>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
