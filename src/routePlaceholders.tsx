import { useLocation } from "react-router";
import { AuthPageSkeleton } from "@/components/loading/AuthPageSkeleton";
import { AccountChromeSkeleton, WorkspaceChromeSkeleton } from "@/components/loading/LayoutChromeSkeleton";
import { LearnShellSkeleton, RouteSkeleton } from "@/components/loading/RouteSkeleton";
import { isWorkspacePath, routeSkeletonVariantForPath } from "@/components/loading/routeSkeletonVariant";
import { CourseDetailLoading } from "@/pages/course-details/components/CourseDetailStates";
import { CoursesPageSkeleton } from "@/pages/courses/courses-page/CoursesPageSkeleton";
import { ContestDetailLoadingCard } from "@/pages/hackathon-detail/components/ContestDetailGateStates";
import { InstructorCoursesSkeleton } from "@/pages/instructor/InstructorCoursesSkeleton";
import { OCIDRedirectLoading } from "@/pages/OCIDRedirectLoading";
import { ProjectDetailSkeleton } from "@/pages/projects/ProjectDetailSkeleton";

type RoutePlaceholderProps = {
  pathname: string;
  /**
   * Draw the admin/instructor/account layout chrome around the page placeholder. True wherever
   * the placeholder stands in for the layout too (bootstrap, MainLayout, guards and fallbacks
   * outside those layouts); false for fallbacks rendered inside the layout's Outlet.
   */
  withLayoutChrome?: boolean;
};

/**
 * The single loading placeholder for a URL. Pages with their own loading layout export it and
 * use it themselves, so the bootstrap screen, guards, Suspense fallback and page all draw the
 * same skeleton instead of swapping one for another.
 */
export function RoutePlaceholder({ pathname, withLayoutChrome = true }: RoutePlaceholderProps) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/login") return <AuthPageSkeleton />;
  if (path === "/ocid-redirect") return <OCIDRedirectLoading />;
  if (path === "/courses") return <CoursesPageSkeleton />;
  if (/^\/courses\/[^/]+$/.test(path)) return <CourseDetailLoading />;
  if (/^\/projects\/[^/]+$/.test(path) && path !== "/projects/new") return <ProjectDetailSkeleton />;
  if (/^\/hackathons\/[^/]+/.test(path)) return <ContestDetailLoadingCard />;

  const variant = routeSkeletonVariantForPath(path);
  if (variant === "learn") return <LearnShellSkeleton className="h-dvh" />;
  if (path.startsWith("/account")) {
    const page = <RouteSkeleton variant={path === "/account/projects" ? "list" : "form"} bare />;
    return withLayoutChrome ? <AccountChromeSkeleton>{page}</AccountChromeSkeleton> : page;
  }
  const page =
    path === "/instructor/courses" ? <InstructorCoursesSkeleton /> : <RouteSkeleton variant={variant} />;
  return withLayoutChrome && isWorkspacePath(path) ? <WorkspaceChromeSkeleton>{page}</WorkspaceChromeSkeleton> : page;
}

/** `RoutePlaceholder` for the current router location (guards and layout fallbacks). */
export function LocationPlaceholder({ withLayoutChrome }: { withLayoutChrome?: boolean }) {
  const { pathname } = useLocation();
  return <RoutePlaceholder pathname={pathname} withLayoutChrome={withLayoutChrome} />;
}
