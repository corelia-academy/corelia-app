import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router";
import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  PlusCircle,
  Receipt,
  Trophy,
  UserCircle,
  Video,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getCourse } from "@/lib/courses";
import { useAuth } from "@/stores/authStore";
import { canManageContests, canManageOfflineAcademy } from "@/lib/permissions";
import { useTranslation } from "react-i18next";

function InstructorSidebar() {
  const { t } = useTranslation("instructor");
  const location = useLocation();
  const pathname = location.pathname;
  const { profile } = useAuth();
  const isExternalInstructor =
    profile?.role === "instructor" && profile?.instructor_origin === "external";
  const showContests = canManageContests(profile);
  const showOfflineAcademy = canManageOfflineAcademy(profile);

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
              {showOfflineAcademy && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="rounded-xl"
                    tooltip={t("sidebar.offlineClasses")}
                    isActive={pathname.startsWith("/instructor/cohorts")}
                    render={
                      <NavLink
                        to="/instructor/cohorts"
                        end
                        className="flex w-full items-center gap-2"
                      >
                        <CalendarDays className="size-4" aria-hidden />
                        <span>{t("sidebar.offlineClasses")}</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              )}
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
              {showContests && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="rounded-xl"
                    tooltip={t("sidebar.contests")}
                    isActive={pathname.startsWith("/instructor/contests")}
                    render={
                      <NavLink
                        to="/instructor/contests"
                        end
                        className="flex w-full items-center gap-2"
                      >
                        <Trophy className="size-4" aria-hidden />
                        <span>{t("sidebar.contests")}</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              )}
              {isExternalInstructor && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="rounded-xl"
                      tooltip={t("sidebar.contracts")}
                      isActive={pathname === "/instructor/contracts"}
                      render={
                        <NavLink
                          to="/instructor/contracts"
                          end
                          className="flex w-full items-center gap-2"
                        >
                          <FileText className="size-4" aria-hidden />
                          <span>{t("sidebar.contracts")}</span>
                        </NavLink>
                      }
                    />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="rounded-xl"
                      tooltip={t("sidebar.invoices")}
                      isActive={pathname === "/instructor/invoices"}
                      render={
                        <NavLink
                          to="/instructor/invoices"
                          end
                          className="flex w-full items-center gap-2"
                        >
                          <Receipt className="size-4" aria-hidden />
                          <span>{t("sidebar.invoices")}</span>
                        </NavLink>
                      }
                    />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="rounded-xl"
                      tooltip={t("sidebar.payments")}
                      isActive={pathname === "/instructor/payments"}
                      render={
                        <NavLink
                          to="/instructor/payments"
                          end
                          className="flex w-full items-center gap-2"
                        >
                          <CreditCard className="size-4" aria-hidden />
                          <span>{t("sidebar.payments")}</span>
                        </NavLink>
                      }
                    />
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

export default function InstructorLayout() {
  const { t } = useTranslation("instructor");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const pathname = location.pathname;
  const { profile } = useAuth();

  const needsCourseTitle =
    !!id &&
    pathname.startsWith("/instructor/courses/") &&
    pathname.endsWith("/edit");

  const [courseTitle, setCourseTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!needsCourseTitle || !id) return;
    let cancelled = false;
    getCourse(id)
      .then((c) => {
        if (!cancelled) setCourseTitle(c?.title ?? null);
      })
      .catch(() => {
        if (!cancelled) setCourseTitle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id, needsCourseTitle]);

  const crumbs: Array<{ label: string; to?: string }> = useMemo(() => {
    const list: Array<{ label: string; to?: string }> = [
      { label: translate("layout.crumbs.home"), to: "/" },
      { label: translate("layout.crumbs.teaching"), to: "/instructor/courses" },
    ];

    if (pathname === "/instructor/courses/new") {
      list.push({ label: translate("layout.crumbs.createCourse") });
    } else if (pathname === "/instructor/cohorts") {
      list.push({ label: translate("layout.crumbs.offlineClasses") });
    } else if (pathname === "/instructor/cohorts/new") {
      list.push({
        label: translate("layout.crumbs.offlineClasses"),
        to: "/instructor/cohorts",
      });
      list.push({ label: translate("layout.crumbs.createCohort") });
    } else if (pathname.startsWith("/instructor/cohorts/") && pathname.endsWith("/manage")) {
      list.push({
        label: translate("layout.crumbs.offlineClasses"),
        to: "/instructor/cohorts",
      });
      list.push({ label: translate("layout.crumbs.cohortWorkspace") });
    } else if (pathname === "/instructor/contests") {
      list.push({ label: translate("layout.crumbs.contests") });
    } else if (pathname === "/instructor/contests/new") {
      list.push({ label: translate("layout.crumbs.contests"), to: "/instructor/contests" });
      list.push({ label: translate("layout.crumbs.createContest") });
    } else if (pathname.startsWith("/instructor/contests/") && pathname.endsWith("/manage")) {
      list.push({ label: translate("layout.crumbs.contests"), to: "/instructor/contests" });
      list.push({ label: translate("layout.crumbs.contestWorkspace") });
    } else if (pathname === "/instructor/contracts") {
      list.push({ label: translate("layout.crumbs.contracts") });
    } else if (pathname === "/instructor/invoices") {
      list.push({ label: translate("layout.crumbs.invoices") });
    } else if (pathname === "/instructor/payments") {
      list.push({ label: translate("layout.crumbs.payments") });
    } else if (pathname === "/instructor/profile") {
      list.push({ label: translate("layout.crumbs.profile") });
    } else if (needsCourseTitle) {
      list.push({ label: courseTitle ?? translate("layout.crumbs.course") });
      list.push({ label: translate("layout.crumbs.edit") });
    }

    return list;
  }, [pathname, needsCourseTitle, courseTitle, translate]);

  const shellMeta = useMemo(() => {
    if (pathname === "/instructor/courses/new") {
      return {
        title: translate("layout.shell.newCourse.title"),
        description: translate("layout.shell.newCourse.description"),
      };
    }
    if (pathname === "/instructor/cohorts") {
      return {
        title: translate("layout.shell.offlineList.title"),
        description: translate("layout.shell.offlineList.description"),
      };
    }
    if (pathname === "/instructor/cohorts/new") {
      return {
        title: translate("layout.shell.newCohort.title"),
        description: translate("layout.shell.newCohort.description"),
      };
    }
    if (pathname.startsWith("/instructor/cohorts/") && pathname.endsWith("/manage")) {
      return {
        title: translate("layout.shell.cohortWorkspace.title"),
        description: translate("layout.shell.cohortWorkspace.description"),
      };
    }
    if (pathname === "/instructor/contests") {
      return {
        title: translate("layout.shell.contestsList.title"),
        description: translate("layout.shell.contestsList.description"),
      };
    }
    if (pathname === "/instructor/contests/new") {
      return {
        title: translate("layout.shell.newContest.title"),
        description: translate("layout.shell.newContest.description"),
      };
    }
    if (pathname.startsWith("/instructor/contests/") && pathname.endsWith("/manage")) {
      return {
        title: translate("layout.shell.contestWorkspace.title"),
        description: translate("layout.shell.contestWorkspace.description"),
      };
    }
    if (pathname === "/instructor/profile") {
      return {
        title: translate("layout.shell.profile.title"),
        description: translate("layout.shell.profile.description"),
      };
    }
    if (pathname === "/instructor/contracts") {
      return {
        title: translate("layout.shell.contracts.title"),
        description: translate("layout.shell.contracts.description"),
      };
    }
    if (pathname === "/instructor/invoices") {
      return {
        title: translate("layout.shell.invoices.title"),
        description: translate("layout.shell.invoices.description"),
      };
    }
    if (pathname === "/instructor/payments") {
      return {
        title: translate("layout.shell.payments.title"),
        description: translate("layout.shell.payments.description"),
      };
    }
    if (needsCourseTitle) {
      return {
        title: courseTitle ?? translate("layout.shell.editCourse.titleFallback"),
        description: translate("layout.shell.editCourse.description"),
      };
    }
    return {
      title: translate("layout.shell.courseList.title"),
      description: translate("layout.shell.courseList.description"),
    };
  }, [pathname, needsCourseTitle, courseTitle, translate]);

  return (
    <SidebarProvider
      defaultOpen
      style={{ "--app-header-height": "2.75rem" } as React.CSSProperties}
    >
      <InstructorSidebar />
      <SidebarInset>
        <div className="sticky top-0 z-30 border-b border-border-subtle bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
          <div className="flex h-11 items-center gap-2 px-3 md:px-4">
            <SidebarTrigger />
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((c, idx) => {
                  const isLast = idx === crumbs.length - 1;
                  return (
                    <BreadcrumbItem key={`${c.label}-${idx}`}>
                      {idx > 0 ? <BreadcrumbSeparator /> : null}
                      {isLast || !c.to ? (
                        <BreadcrumbPage>{c.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink>
                          <Link to={c.to}>{c.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="px-3 pb-4 md:px-4">
            <div className="rounded-md border border-border-subtle bg-card/85 px-4 py-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {translate("layout.hero.eyebrow")}
              </p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="text-2xl font-normal tracking-tight text-foreground">
                    {shellMeta.title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-sm">
                    {shellMeta.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
                    {profile?.instructor_origin === "external"
                      ? translate("layout.badges.externalPartner")
                      : translate("layout.badges.coreliaInstructor")}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
                    {profile?.role === "admin"
                      ? translate("layout.badges.adminMode")
                      : translate("layout.badges.teachingMode")}
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
