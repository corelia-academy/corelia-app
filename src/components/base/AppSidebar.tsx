import { NavLink, useLocation } from "react-router";
import {
  Briefcase,
  BookOpen,
  GraduationCap,
  Home,
  Rss,
  Settings,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { ShowForRole } from "@/components/auth/ShowForRole";
import { useTranslation } from "react-i18next";
import { ROLE_GROUPS } from "@/config/roles";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/stores/authStore";
import { canSpeculativelyPrefetch, prefetchRouteChunk } from "@/lib/routePrefetch";

const primaryNav = [
  { labelKey: "nav.home" as const, href: "/", icon: Home, end: true },
  { labelKey: "nav.feed" as const, href: "/feed", icon: Rss },
  { labelKey: "nav.courses" as const, href: "/courses", icon: BookOpen },
  { labelKey: "nav.career" as const, href: "/career", icon: Briefcase },
] as const;

export default function AppSidebar({
  collapsible = "icon",
  className,
}: {
  collapsible?: "offcanvas" | "icon" | "none";
  className?: string;
}) {
  const { t } = useTranslation("common");
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isMobile } = useSidebar();
  const { resolvedTheme } = useTheme();
  const location = useLocation();
  const pathname = location.pathname;
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const prefetchPrimaryRoute = async (href: string) => {
    if (!canSpeculativelyPrefetch()) return;
    prefetchRouteChunk(href);
    try {
      if (href === "/") {
        const { homeCatalogQueryOptions } = await import(
          "@/pages/home/queries/homeQueries"
        );
        await queryClient.prefetchQuery(homeCatalogQueryOptions(user, locale));
      } else if (href === "/feed" && user?.id) {
        const { feedTimelineQueryOptions } = await import(
          "@/features/feed/feedQueries"
        );
        await queryClient.prefetchInfiniteQuery(feedTimelineQueryOptions(user.id));
      } else if (href === "/courses") {
        const { coursesCatalogQueryOptions } = await import(
          "@/features/courses/courseQueries"
        );
        await queryClient.prefetchQuery(coursesCatalogQueryOptions(locale));
      } else if (href === "/career") {
        const { careerCatalogQueryOptions } = await import(
          "@/features/career/careerQueries"
        );
        await queryClient.prefetchQuery(careerCatalogQueryOptions(locale));
      }
    } catch {
      // Speculative work must never affect navigation.
    }
  };

  return (
    <Sidebar
      collapsible={collapsible}
      variant="sidebar"
      className={className}
    >
      {isMobile ? (
        <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
          <NavLink to="/" className="inline-flex w-fit items-center">
            <img
              src={
                resolvedTheme === "dark"
                  ? "/logo/corelia-full-logo-white.png"
                  : "/logo/corelia-full-logo-black.png"
              }
              alt="Corelia Academy"
              className="h-9 w-auto"
            />
          </NavLink>
        </SidebarHeader>
      ) : null}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-1">
            <SidebarMenu className="gap-1">
              {primaryNav.map((item) => {
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
                          onPointerEnter={() => void prefetchPrimaryRoute(item.href)}
                          onFocus={() => void prefetchPrimaryRoute(item.href)}
                        >
                          <Icon className="size-5 shrink-0" aria-hidden />
                          <span>{t(item.labelKey)}</span>
                        </NavLink>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
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
                        onPointerEnter={() => prefetchRouteChunk("/instructor/courses")}
                        onFocus={() => prefetchRouteChunk("/instructor/courses")}
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
                        onPointerEnter={() => prefetchRouteChunk("/admin")}
                        onFocus={() => prefetchRouteChunk("/admin")}
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
