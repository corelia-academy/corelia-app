import { useCallback, useMemo } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router";
import React from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import { InstructorSidebar } from "@/features/instructor/layout/InstructorSidebar";
import {
  buildInstructorCrumbs,
  resolveInstructorShellMeta,
} from "@/features/instructor/layout/instructorLayoutResolvers";
import { useInstructorCourseTitle } from "@/features/instructor/layout/hooks/useInstructorCourseTitle";

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
  const { courseTitle } = useInstructorCourseTitle({
    id,
    enabled: needsCourseTitle,
  });

  const crumbs = useMemo(
    () =>
      buildInstructorCrumbs({
        pathname,
        needsCourseTitle,
        courseTitle,
        translate,
      }),
    [pathname, needsCourseTitle, courseTitle, translate],
  );

  const shellMeta = useMemo(
    () =>
      resolveInstructorShellMeta({
        pathname,
        needsCourseTitle,
        courseTitle,
        translate,
      }),
    [pathname, needsCourseTitle, courseTitle, translate],
  );

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
