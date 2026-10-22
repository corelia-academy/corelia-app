import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { AppLoadingScreen } from "@/components/loading/AppLoadingScreen";
import { AccountChromeSkeleton, WorkspaceChromeSkeleton } from "@/components/loading/LayoutChromeSkeleton";
import { LearnShellSkeleton, RouteSkeleton } from "@/components/loading/RouteSkeleton";
import { isWorkspacePath, routeSkeletonVariantForPath } from "@/components/loading/routeSkeletonVariant";
import { isInitialLoad } from "@/components/loading/skeletonReveal";
import { CourseDetailLoading } from "@/pages/course-details/components/CourseDetailStates";
import { CoursesPageSkeleton } from "@/pages/courses/courses-page/CoursesPageSkeleton";
import { ContestDetailLoadingCard } from "@/pages/hackathon-detail/components/ContestDetailGateStates";
import { HomePageSkeleton } from "@/pages/home/HomePageSkeleton";
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
  if (path === "/") return <HomePageSkeleton />;
  if (path === "/login") return <AppLoadingScreen />;
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

/**
 * Route chunk / guard fallback: the global loading screen on the first visit (boot, layout and
 * page chunks show as one loading state), the route's skeleton after an in-app navigation.
 */
export function InitialLoadFallback({ children }: { children: ReactNode }) {
  return isInitialLoad() ? <AppLoadingScreen /> : <>{children}</>;
}

/** `RoutePlaceholder` for the current router location (guards and layout fallbacks). */
export function LocationPlaceholder({ withLayoutChrome }: { withLayoutChrome?: boolean }) {
  const { pathname } = useLocation();
  return (
    <InitialLoadFallback>
      <RoutePlaceholder pathname={pathname} withLayoutChrome={withLayoutChrome} />
    </InitialLoadFallback>
  );
}
