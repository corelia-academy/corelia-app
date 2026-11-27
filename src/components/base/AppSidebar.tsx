import { NavLink, useLocation } from "react-router";
import {
  Briefcase,
  BookOpen,
  GraduationCap,
  FolderSimple,
  House,
  Newspaper,
  MedalMilitary,
  ArrowUpRight,
  ChatText,
  Compass,
  MegaphoneSimple,
  ArrowLeft,
  Gear,
  IdentificationCard,
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
import { appPath } from "@/lib/appUrl";

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
    href: "/blog",
    icon: MegaphoneSimple,
    showArrow: true,
  },
  {
    labelKey: "nav.productRoadmap",
    href: "https://github.com/corelia-academy/corelia-app/releases",
    icon: Compass,
    showArrow: true,
  },
  {
    labelKey: "nav.feedback",
    href: "/contact",
    icon: ChatText,
    showArrow: false,
  },
] as const;

// Khu Cài đặt theo Figma: menu trái đổi thành "Quay lại" và các trang cùng khu.
const settingsNav = [
  { labelKey: "nav.settings.title", href: "/account/settings", icon: Gear },
  { labelKey: "nav.cv.title", href: "/account/cv", icon: IdentificationCard },
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
  const { t: tAccount } = useTranslation("account");
  const isSettingsArea = settingsNav.some((item) => pathname === item.href);
  const settingsRows = [
    { href: "/", label: t("actions.back"), icon: ArrowLeft, active: false },
    ...settingsNav.map((item) => ({ href: item.href, label: tAccount(item.labelKey), icon: item.icon, active: pathname === item.href })),
  ];
  const settingsRow = ({ href, label, icon: Icon, active }: (typeof settingsRows)[number]) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton
        size="appNav"
        className="min-h-0! gap-lg rounded-md p-2md"
        tooltip={label}
        isActive={active}
        render={
          <NavLink to={href} end className="flex w-full items-center">
            <Icon className="size-5! shrink-0" weight="duotone" aria-hidden />
            <span>{label}</span>
          </NavLink>
        }
      />
    </SidebarMenuItem>
  );

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
                  ? appPath("/logo/Corelia_Logo_White.svg")
                  : appPath("/logo/corelia-full-logo-black.png")
              }
              alt="Corelia Academy"
              width={108}
              height={36}
              className="h-9 w-auto"
            />
          </NavLink>
        </SidebarHeader>
      ) : null}

      <SidebarContent className="p-lg">
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

        {isSettingsArea ? (
          <SidebarGroup className="gap-xl p-0">
            <SidebarGroupContent>
              <SidebarMenu>{settingsRow(settingsRows[0])}</SidebarMenu>
            </SidebarGroupContent>
            <SidebarSeparator className="mx-0" />
            <SidebarGroupContent>
              <SidebarMenu>{settingsRows.slice(1).map(settingsRow)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
        <SidebarGroup className="gap-2xl p-0">
          {primaryNavSections.map((section) => (
            <SidebarGroupContent
              key={section.labelKey ?? "home"}
            >
              {section.labelKey ? (
                <SidebarGroupLabel className="h-5 gap-4 px-0 pb-md text-body-xsmall">
                  {t(section.labelKey)}
                  <SidebarSeparator className="mx-0 min-w-0 flex-1 shrink" />
                </SidebarGroupLabel>
              ) : null}

              <SidebarMenu>
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

        <SidebarSeparator className="mt-lg" />

        <SidebarGroup className="px-0 py-md">
          <SidebarGroupContent>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto p-0">
          <SidebarGroupContent>
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
                          target="_blank"
                          rel="noopener noreferrer"
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
          </>
        )}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
