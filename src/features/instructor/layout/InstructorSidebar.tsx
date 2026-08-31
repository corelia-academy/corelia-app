import { NavLink, useLocation } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  GraduationCap,
  PlusCircle,
  UserCircle,
  Video,
  Layers,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export function InstructorSidebar() {
  const { t } = useTranslation("instructor");
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <div className="px-3 pb-2 pt-3 transition-[padding] duration-200 ease-linear group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-1">
        <div className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/45 p-4 transition-[padding,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:p-1">
          <div className="flex items-start gap-3 transition-[gap] duration-200 ease-linear group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-[width,height,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:size-8">
              <GraduationCap className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
                {t("sidebar.title")}
              </div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-sidebar-foreground/72">
                {t("sidebar.subtitle")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2 px-1">
            <SidebarMenu className="flex flex-col gap-2">
              <SidebarMenuItem className="flex items-center gap-2">
                <NavLink to="/instructor/courses/new" className="flex w-full">
                  <SidebarMenuButton
                    tooltip={t("sidebar.createCourse")}
                    className="min-w-8 w-full cursor-pointer rounded-xl bg-primary text-sm font-medium text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                  >
                    <PlusCircle className="size-4" aria-hidden />
                    <span>{t("sidebar.createCourse")}</span>
                  </SidebarMenuButton>
                </NavLink>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip={t("sidebar.courseList")}
                  isActive={
                    pathname === "/instructor/courses" ||
                    (pathname.startsWith("/instructor/courses/") &&
                      pathname !== "/instructor/courses/new")
                  }
                  render={
                    <NavLink
                      to="/instructor/courses"
                      end
                      className="flex w-full items-center gap-2"
                    >
                      <Video className="size-4" aria-hidden />
                      <span>{t("sidebar.courseList")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip={t("sidebar.careerTracks")}
                  isActive={pathname.startsWith("/instructor/career-tracks")}
                  render={
                    <NavLink
                      to="/instructor/career-tracks"
                      end
                      className="flex w-full items-center gap-2"
                    >
                      <Layers className="size-4" aria-hidden />
                      <span>{t("sidebar.careerTracks")}</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip={t("sidebar.profile")}
                  isActive={pathname === "/instructor/profile"}
                  render={
                    <NavLink
                      to="/instructor/profile"
                      end
                      className="flex w-full items-center gap-2"
                    >
                      <UserCircle className="size-4" aria-hidden />
                      <span>{t("sidebar.profile")}</span>
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
