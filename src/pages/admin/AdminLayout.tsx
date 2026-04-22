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
  Users,
  ChalkboardTeacher,
  Gear,
  ShieldCheck,
  Trophy,
  CalendarDots,
  PushPinSimple,
} from "@phosphor-icons/react";
import { ShowForContestManager } from "@/components/auth/ShowForContestManager";

function AdminSidebar() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <div className="px-3 pb-2 pt-3 transition-[padding] duration-200 ease-linear group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-1">
        <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/45 p-3.5 transition-[padding,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-1">
          <div className="flex items-start gap-3 transition-[gap] duration-200 ease-linear group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-[width,height,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:size-8">
              <Gear className="size-5" weight="fill" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-[13px] font-semibold leading-tight text-sidebar-foreground">
                Corelia Admin
              </div>
              <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-sidebar-foreground/72">
                Phân quyền, giảng viên và các tác vụ điều hành hệ thống hằng ngày.
              </div>
            </div>
          </div>
        </div>
      </div>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Điều hướng chính</SidebarGroupLabel>
          <SidebarGroupContent className="px-1">
            <SidebarMenu className="gap-1.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip="Tài khoản"
                  isActive={pathname === "/admin" || pathname.startsWith("/admin/users")}
                  render={
                    <NavLink to="/admin" end className="flex w-full items-center gap-2">
                      <Users className="size-4" weight="duotone" />
                      <span>Tài khoản</span>
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
                      <PushPinSimple className="size-4" weight="duotone" />
                      <span>Dashboard</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip="Giảng viên"
                  isActive={pathname.startsWith("/admin/instructors")}
                  render={
                    <NavLink
                      to="/admin/instructors"
                      className="flex w-full items-center gap-2"
                    >
                      <ChalkboardTeacher className="size-4" weight="duotone" />
                      <span>Giảng viên</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip="Lớp học trực tiếp"
                  isActive={pathname.startsWith("/instructor/cohorts")}
                  render={
                    <NavLink
                      to="/instructor/cohorts"
                      className="flex w-full items-center gap-2"
                    >
                      <CalendarDots className="size-4" weight="duotone" />
                      <span>Lớp học trực tiếp</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              <ShowForContestManager>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="rounded-xl"
                    tooltip="Cuộc thi"
                    isActive={pathname.startsWith("/instructor/contests")}
                    render={
                      <NavLink
                        to="/instructor/contests"
                        className="flex w-full items-center gap-2"
                      >
                        <Trophy className="size-4" weight="duotone" />
                        <span>Cuộc thi</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              </ShowForContestManager>
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
    title: "Quản lý tài khoản",
    description: "Kiểm soát vai trò và sức khoẻ truy cập của toàn bộ người dùng.",
  },
  {
    match: (pathname: string) => pathname === "/admin/dashboard",
    title: "Cấu hình dashboard",
    description: "Ghim các chương trình quan trọng để xuất hiện đúng vị trí trên Home của học viên.",
  },
  {
    match: (pathname: string) => pathname === "/admin/instructors",
    title: "Quản lý giảng viên",
    description: "Theo dõi hồ sơ, loại giảng viên và dữ liệu hợp tác đối tác.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/admin/instructors/"),
    title: "Chi tiết giảng viên",
    description: "Cập nhật hồ sơ, hợp đồng, hoá đơn và thông tin thanh toán.",
  },
];

export default function AdminLayout() {
  const location = useLocation();
  const currentMeta =
    PAGE_META.find((item) => item.match(location.pathname)) ?? PAGE_META[0];

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
            <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" weight="duotone" />
              <span className="truncate">{currentMeta.title}</span>
            </div>
          </div>
          <div className="px-3 pb-4 md:px-4">
            <div className="rounded-lg border border-border-subtle bg-card/85 px-4 py-4 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Khu vực quản trị
              </p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="text-2xl font-normal tracking-tight text-foreground">
                    {currentMeta.title}
                  </h1>
                  <p className="mt-1.5 max-w-3xl text-[14px] text-muted-foreground sm:text-[15px]">
                    {currentMeta.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
                    Quyền nhạy cảm
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
                    Audit thủ công
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
