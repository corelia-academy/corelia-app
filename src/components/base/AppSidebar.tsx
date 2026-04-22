import { NavLink, useLocation, useNavigate } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import {
  BookOpen,
  CalendarDots,
  Gear,
  GraduationCap,
  House,
  Medal,
  SignIn,
  Trophy,
} from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { ShowForRole } from "@/components/auth/ShowForRole";
import { ShowForAuth } from "@/components/auth/ShowForAuth";
import { getRoleLabel } from "@/types/database";
import { useTranslation } from "react-i18next";

const primaryNav = [
  { labelKey: "nav.home" as const, href: "/", icon: House, end: true },
  { labelKey: "nav.courses" as const, href: "/courses", icon: BookOpen },
  { labelKey: "nav.cohorts" as const, href: "/cohorts", icon: CalendarDots },
  { labelKey: "nav.contests" as const, href: "/contests", icon: Trophy },
] as const;

export default function AppSidebar() {
  const { t } = useTranslation("common");
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { isMobile } = useSidebar();
  const { profile, isAuthenticated } = useAuth();

  const displayName = profile?.full_name ?? profile?.id?.slice(0, 8) ?? "User";
  const avatarUrl = profile?.avatar_url ?? undefined;
  const email = profile ? "(đăng nhập bằng email)" : "";

  return (
    <Sidebar collapsible="icon" variant="sidebar">
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

          <div className="hidden group-data-[collapsible=icon]:hidden md:block">
            <SidebarTrigger />
          </div>
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
                              <Icon className="size-4" weight="duotone" />
                              <span>{t(item.labelKey)}</span>
                            </NavLink>
                          }
                        />
                      </SidebarMenuItem>
                    );
                  })
                : null}

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
                        <Medal className="size-4" weight="duotone" />
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
              <ShowForRole roles={["instructor", "support_staff", "admin"]}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="rounded-md"
                    tooltip="Quản lý giảng dạy"
                    isActive={pathname.startsWith("/instructor")}
                    render={
                      <NavLink
                        to="/instructor/courses"
                        className="flex w-full items-center gap-2"
                      >
                        <GraduationCap className="size-4" weight="duotone" />
                        <span>Giảng dạy</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              </ShowForRole>
              <ShowForRole roles={["admin", "support_staff"]}>
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
                        <Gear className="size-4" weight="duotone" />
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

      <SidebarFooter>
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => navigate("/account")}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1"
          >
            <Avatar className="size-7">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-xs font-medium text-sidebar-foreground">
                {displayName}
              </div>
              <div className="truncate text-[11px] text-sidebar-foreground/70">
                {profile?.role ? getRoleLabel(profile.role) : email}
              </div>
            </div>
          </button>
        ) : (
          <Button
            render={<NavLink to="/login" />}
            nativeButton={false}
            className="w-full rounded-md group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:px-0"
            size="sm"
          >
            <SignIn className="size-4" weight="duotone" />
            <span className="group-data-[collapsible=icon]:hidden">
              {t("tabs.signIn")}
            </span>
          </Button>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

