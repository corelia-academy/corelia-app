import { useEffect, useMemo, useState } from "react";
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
  CreditCard,
  FileText,
  PlusCircleIcon,
  Receipt,
  Trophy,
  UserCircle,
  VideoIcon,
  CalendarDots,
  GraduationCap,
} from "@phosphor-icons/react";
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

function InstructorSidebar() {
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
        <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/45 p-3.5 transition-[padding,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-1">
          <div className="flex items-start gap-3 transition-[gap] duration-200 ease-linear group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-[width,height,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:size-8">
              <GraduationCap className="size-5" weight="fill" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-[13px] font-semibold leading-tight text-sidebar-foreground">
                Corelia Instructor
              </div>
              <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-sidebar-foreground/72">
                Quản lý khoá học, hồ sơ và các tác vụ vận hành trong một nơi.
              </div>
            </div>
          </div>
        </div>
      </div>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2 px-1">
            <SidebarMenu className="flex flex-col gap-1.5">
              <SidebarMenuItem className="flex items-center gap-2">
                <NavLink to="/instructor/courses/new" className="flex w-full">
                  <SidebarMenuButton
                    tooltip="Tạo khoá học"
                    className="min-w-8 w-full cursor-pointer rounded-xl bg-primary text-[13px] font-medium text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                  >
                    <PlusCircleIcon />
                    <span>Tạo khoá học</span>
                  </SidebarMenuButton>
                </NavLink>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip="Danh sách khoá học"
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
                      <VideoIcon className="size-4" weight="duotone" />
                      <span>Danh sách khoá học</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              {showOfflineAcademy && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="rounded-xl"
                    tooltip="Lớp học trực tiếp"
                    isActive={pathname.startsWith("/instructor/cohorts")}
                    render={
                      <NavLink
                        to="/instructor/cohorts"
                        end
                        className="flex w-full items-center gap-2"
                      >
                        <CalendarDots className="size-4" weight="duotone" />
                        <span>Lớp học trực tiếp</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-xl"
                  tooltip="Hồ sơ giảng viên"
                  isActive={pathname === "/instructor/profile"}
                  render={
                    <NavLink
                      to="/instructor/profile"
                      end
                      className="flex w-full items-center gap-2"
                    >
                      <UserCircle className="size-4" weight="duotone" />
                      <span>Hồ sơ giảng viên</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
              {showContests && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="rounded-xl"
                    tooltip="Cuộc thi"
                    isActive={pathname.startsWith("/instructor/contests")}
                    render={
                      <NavLink
                        to="/instructor/contests"
                        end
                        className="flex w-full items-center gap-2"
                      >
                        <Trophy className="size-4" weight="duotone" />
                        <span>Cuộc thi</span>
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
                      tooltip="Hợp đồng"
                      isActive={pathname === "/instructor/contracts"}
                      render={
                        <NavLink
                          to="/instructor/contracts"
                          end
                          className="flex w-full items-center gap-2"
                        >
                          <FileText className="size-4" weight="duotone" />
                          <span>Hợp đồng</span>
                        </NavLink>
                      }
                    />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="rounded-xl"
                      tooltip="Hoá đơn"
                      isActive={pathname === "/instructor/invoices"}
                      render={
                        <NavLink
                          to="/instructor/invoices"
                          end
                          className="flex w-full items-center gap-2"
                        >
                          <Receipt className="size-4" weight="duotone" />
                          <span>Hoá đơn</span>
                        </NavLink>
                      }
                    />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="rounded-xl"
                      tooltip="Thanh toán"
                      isActive={pathname === "/instructor/payments"}
                      render={
                        <NavLink
                          to="/instructor/payments"
                          end
                          className="flex w-full items-center gap-2"
                        >
                          <CreditCard className="size-4" weight="duotone" />
                          <span>Thanh toán</span>
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
      { label: "Home", to: "/" },
      { label: "Quản lý giảng dạy", to: "/instructor/courses" },
    ];

    if (pathname === "/instructor/courses/new") {
      list.push({ label: "Tạo khoá học" });
    } else if (pathname === "/instructor/cohorts") {
      list.push({ label: "Lớp học trực tiếp" });
    } else if (pathname === "/instructor/cohorts/new") {
      list.push({ label: "Lớp học trực tiếp", to: "/instructor/cohorts" });
      list.push({ label: "Tạo cohort" });
    } else if (pathname.startsWith("/instructor/cohorts/") && pathname.endsWith("/manage")) {
      list.push({ label: "Lớp học trực tiếp", to: "/instructor/cohorts" });
      list.push({ label: "Khu vực vận hành cohort" });
    } else if (pathname === "/instructor/contests") {
      list.push({ label: "Cuộc thi" });
    } else if (pathname === "/instructor/contests/new") {
      list.push({ label: "Cuộc thi", to: "/instructor/contests" });
      list.push({ label: "Tạo contest" });
    } else if (pathname.startsWith("/instructor/contests/") && pathname.endsWith("/manage")) {
      list.push({ label: "Cuộc thi", to: "/instructor/contests" });
      list.push({ label: "Khu vực vận hành cuộc thi" });
    } else if (pathname === "/instructor/contracts") {
      list.push({ label: "Hợp đồng" });
    } else if (pathname === "/instructor/invoices") {
      list.push({ label: "Hoá đơn" });
    } else if (pathname === "/instructor/payments") {
      list.push({ label: "Thanh toán" });
    } else if (pathname === "/instructor/profile") {
      list.push({ label: "Hồ sơ giảng viên" });
    } else if (needsCourseTitle) {
      list.push({ label: courseTitle ?? "Khoá học" });
      list.push({ label: "Chỉnh sửa" });
    }

    return list;
  }, [pathname, needsCourseTitle, courseTitle]);

  const shellMeta = useMemo(() => {
    if (pathname === "/instructor/courses/new") {
      return {
        title: "Tạo khoá học mới",
        description: "Khởi tạo nội dung, mô hình giá và hành trình học ngay từ đầu.",
      };
    }
    if (pathname === "/instructor/cohorts") {
      return {
        title: "Danh sách lớp trực tiếp",
        description: "Điều phối cohort offline, lịch học, địa điểm và recording theo từng buổi.",
      };
    }
    if (pathname === "/instructor/cohorts/new") {
      return {
        title: "Tạo cohort mới",
        description: "Khởi tạo lớp học offline với lịch học, Google Meet và lộ trình học viên.",
      };
    }
    if (pathname.startsWith("/instructor/cohorts/") && pathname.endsWith("/manage")) {
      return {
        title: "Khu vực vận hành cohort",
        description: "Quản lý lịch buổi học, roster và roadmap của học viên trong cùng một nơi.",
      };
    }
    if (pathname === "/instructor/contests") {
      return {
        title: "Danh sách contests",
        description: "Quản lý hackathon và contest như một phần của hoạt động giảng dạy.",
      };
    }
    if (pathname === "/instructor/contests/new") {
      return {
        title: "Tạo contest mới",
        description: "Khởi tạo hoạt động thi đấu, timeline và luồng vận hành trong workspace.",
      };
    }
    if (pathname.startsWith("/instructor/contests/") && pathname.endsWith("/manage")) {
      return {
        title: "Khu vực vận hành cuộc thi",
        description: "Điều phối đăng ký, ban giám khảo, bài nộp và kết quả trong một nơi.",
      };
    }
    if (pathname === "/instructor/profile") {
      return {
        title: "Hồ sơ giảng viên",
        description: "Giữ hồ sơ chuyên môn, mô tả và thông tin hợp tác luôn rõ ràng.",
      };
    }
    if (pathname === "/instructor/contracts") {
      return {
        title: "Hợp đồng đối tác",
        description: "Theo dõi tài liệu hợp tác và những bản cập nhật mới nhất.",
      };
    }
    if (pathname === "/instructor/invoices") {
      return {
        title: "Hoá đơn",
        description: "Tập trung toàn bộ hoá đơn để đối soát và làm việc với vận hành.",
      };
    }
    if (pathname === "/instructor/payments") {
      return {
        title: "Thanh toán",
        description: "Kiểm tra thông tin nhận tiền và lịch sử phối hợp với đội ngũ.",
      };
    }
    if (needsCourseTitle) {
      return {
        title: courseTitle ?? "Chỉnh sửa khoá học",
        description: "Điều chỉnh nội dung, học viên và cấu hình kinh doanh trong cùng một nơi.",
      };
    }
    return {
      title: "Danh sách khoá học",
      description: "Theo dõi toàn bộ sản phẩm đào tạo, trạng thái xuất bản và bước tiếp theo.",
    };
  }, [pathname, needsCourseTitle, courseTitle]);

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
            <div className="rounded-lg border border-border-subtle bg-card/85 px-4 py-4 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Khu vực giảng dạy
              </p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="text-2xl font-normal tracking-tight text-foreground">
                    {shellMeta.title}
                  </h1>
                  <p className="mt-1.5 max-w-3xl text-[14px] text-muted-foreground sm:text-[15px]">
                    {shellMeta.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
                    {profile?.instructor_origin === "external"
                      ? "Đối tác bên ngoài"
                      : "Giảng viên Corelia"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
                    {profile?.role === "admin" ? "Chế độ quản trị" : "Tác vụ giảng dạy"}
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
