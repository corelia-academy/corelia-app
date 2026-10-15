import { useLocation } from "react-router";
import { LearnShellSkeleton, RouteSkeleton } from "@/components/loading/RouteSkeleton";
import { routeSkeletonVariantForPath } from "@/components/loading/routeSkeletonVariant";
import { CourseDetailLoading } from "@/pages/course-details/components/CourseDetailStates";
import { CoursesPageSkeleton } from "@/pages/courses/courses-page/CoursesPageSkeleton";
import { ContestDetailLoadingCard } from "@/pages/hackathon-detail/components/ContestDetailGateStates";
import { InstructorCoursesSkeleton } from "@/pages/instructor/InstructorCoursesSkeleton";
import { ProjectDetailSkeleton } from "@/pages/projects/ProjectDetailSkeleton";

/**
 * The single loading placeholder for a URL. Pages with their own loading layout export it and
 * use it themselves, so the bootstrap screen, guards, Suspense fallback and page all draw the
 * same skeleton instead of swapping one for another.
 */
export function RoutePlaceholder({ pathname }: { pathname: string }) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/courses") return <CoursesPageSkeleton />;
  if (/^\/courses\/[^/]+$/.test(path)) return <CourseDetailLoading />;
  if (/^\/projects\/[^/]+$/.test(path) && path !== "/projects/new") return <ProjectDetailSkeleton />;
  if (/^\/hackathons\/[^/]+/.test(path)) return <ContestDetailLoadingCard />;
  if (path === "/instructor/courses") return <InstructorCoursesSkeleton />;
  const variant = routeSkeletonVariantForPath(path);
  if (variant === "learn") return <LearnShellSkeleton className="h-dvh" />;
  return <RouteSkeleton variant={variant} />;
}

/** `RoutePlaceholder` for the current router location (guards and layout fallbacks). */
export function LocationPlaceholder() {
  const { pathname } = useLocation();
  return <RoutePlaceholder pathname={pathname} />;
}
