import { NavLink, useLocation } from "react-router";
import {
  Briefcase,
  BookOpen,
  GraduationCap,
  FolderSimple,
  Gear,
  House,
  Newspaper,
  MedalMilitary,
  ArrowUpRight,
  ChatText,
  Compass,
  MegaphoneSimple,
} from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

// const primaryNav = [
//   { labelKey: "nav.home" as const, href: "/", icon: House, end: true },
//   { labelKey: "nav.feed" as const, href: "/feed", icon: Newspaper },
//   { labelKey: "nav.courses" as const, href: "/courses", icon: BookOpen },
//   { labelKey: "nav.contests" as const, href: "/hackathons", icon: Trophy },
//   { labelKey: "nav.projects" as const, href: "/projects", icon: Folder },
//   { labelKey: "nav.jobs" as const, href: "/jobs", icon: Briefcase },
// ] as const;
const primaryNavSections = [
  {
    labelKey: null,
    items: [{ labelKey: "nav.home", href: "/", icon: House, end: true }],
  },
  {
    labelKey: "nav.groups.learning",
    items: [
      { labelKey: "nav.feed", href: "/feed", icon: Newspaper },
      { labelKey: "nav.courses", href: "/courses", icon: BookOpen },
    ],
  },
  {
    labelKey: "nav.groups.building",
    items: [
      { labelKey: "nav.contests", href: "/hackathons", icon: MedalMilitary },
      { labelKey: "nav.projects", href: "/projects", icon: FolderSimple },
    ],
  },
  {
    labelKey: "nav.groups.career",
    items: [
      { labelKey: "nav.jobs", href: "/jobs", icon: Briefcase },
    ],
  },
] as const;

const sidebarUtilityLinks = [
  {
    labelKey: "nav.changelog",
    href: "https://corelia.academy/blog/",
    icon: MegaphoneSimple,
    showArrow: true,
  },
  {
    labelKey: "nav.productRoadmap",
    href: "https://corelia.academy/roadmap/",
    icon: Compass,
    showArrow: true,
  },
  {
    labelKey: "nav.feedback",
    href: "https://corelia.academy/contact/",
    icon: ChatText,
    showArrow: false,
  },
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
        const { milestoneFeedQuery } = await import(
          "@/features/feed/milestoneQueries"
        );
        await queryClient.prefetchInfiniteQuery(milestoneFeedQuery(user.id, "explore"));
      } else if (href === "/courses") {
        const { coursesCatalogQueryOptions } = await import(
          "@/features/courses/courseQueries"
        );
        await queryClient.prefetchQuery(coursesCatalogQueryOptions(locale));
      } else if (href === "/jobs") {
        const { jobsInfiniteCatalogQueryOptions } = await import(
          "@/features/jobs/jobQueries"
        );
        await queryClient.prefetchInfiniteQuery(jobsInfiniteCatalogQueryOptions({ pageSize: 24 }, user?.id));
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
                  ? "/logo/Corelia_Logo_White.svg"
                  : "/logo/corelia-full-logo-black.png"
              }
              alt="Corelia Academy"
              className="h-9 w-auto"
            />
          </NavLink>
        </SidebarHeader>
      ) : null}

      <SidebarContent className="py-lg px-md">
        {/* <SidebarGroup>
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
        </SidebarGroup> */}

        <SidebarGroup className="gap-2xl">
          {primaryNavSections.map((section) => (
            <SidebarGroupContent
              key={section.labelKey ?? "home"}
              className="px-1"
            >
              {section.labelKey ? (
                <SidebarGroupLabel className="h-5 gap-4 px-0 pb-md text-body-xsmall">
                  {t(section.labelKey)}
                  <SidebarSeparator className="mx-0 min-w-0 flex-1 shrink" />
                </SidebarGroupLabel>
              ) : null}

              <SidebarMenu className="gap-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        size="appNav"
                        className="min-h-0! gap-lg rounded-md p-2md"
                        tooltip={t(item.labelKey)}
                        isActive={isActive}
                        render={
                          <NavLink
                            to={item.href}
                            end={"end" in item ? item.end : undefined}
                            className="flex w-full items-center"
                            onPointerEnter={() => void prefetchPrimaryRoute(item.href)}
                            onFocus={() => void prefetchPrimaryRoute(item.href)}
                          >
                            <Icon
                              className="size-5! shrink-0"
                              weight="duotone"
                              aria-hidden
                            />
                            <span>{t(item.labelKey)}</span>
                          </NavLink>
                        }
                      />
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          ))}
        </SidebarGroup>

        <SidebarSeparator className="mt-1" />

        <SidebarGroup>
          <SidebarGroupContent className="px-1">
            <SidebarMenu className="gap-1">
              <ShowForRole roles={ROLE_GROUPS.instructorWorkspace}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="appNav"
                    className="rounded-md min-h-0! p-2md"
                    tooltip={t("nav.instructorManagement")}
                    isActive={pathname.startsWith("/instructor")}
                    render={
                      <NavLink
                        to="/instructor/courses"
                        className="flex w-full items-center gap-2"
                        onPointerEnter={() => prefetchRouteChunk("/instructor/courses")}
                        onFocus={() => prefetchRouteChunk("/instructor/courses")}
                      >
                        <GraduationCap
                          className="size-5! shrink-0"
                          weight="duotone"
                          aria-hidden
                        />
                        <span>{t("nav.instructor")}</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              </ShowForRole>
              <ShowForRole roles={ROLE_GROUPS.admin}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="appNav"
                    className="rounded-md min-h-0! p-2md"
                    tooltip={t("nav.admin")}
                    isActive={pathname.startsWith("/admin")}
                    render={
                      <NavLink
                        to="/admin"
                        className="flex w-full items-center gap-2"
                        onPointerEnter={() => prefetchRouteChunk("/admin")}
                        onFocus={() => prefetchRouteChunk("/admin")}
                      >
                        <Gear
                          className="size-5! shrink-0"
                          weight="duotone"
                          aria-hidden
                        />
                        <span>{t("nav.admin")}</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              </ShowForRole>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent className="px-1">
            <SidebarMenu className="gap-1">
              {sidebarUtilityLinks.map(
                ({ labelKey, href, icon: Icon, showArrow }) => (
                  <SidebarMenuItem key={labelKey}>
                    <SidebarMenuButton
                      size="appNav"
                      className="rounded-md min-h-0! p-2md"
                      tooltip={t(labelKey)}
                      render={
                        <a
                          href={href}
                          className="flex w-full items-center gap-lg"
                        >
                          <Icon
                            className="size-5! shrink-0"
                            weight="duotone"
                            aria-hidden
                          />
                          <span>{t(labelKey)}</span>
                          {showArrow ? (
                            <ArrowUpRight
                              className="ml-auto shrink-0"
                              weight="duotone"
                              aria-hidden
                            />
                          ) : null}
                        </a>
                      }
                    />
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
