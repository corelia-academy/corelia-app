type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

const routeLoaders: Array<{
  matches: (pathname: string) => boolean;
  load: () => Promise<unknown>;
}> = [
  { matches: (path) => path === "/", load: () => import("@/pages/home/index") },
  { matches: (path) => path.startsWith("/feed"), load: () => import("@/pages/feed/FeedPage") },
  { matches: (path) => /^\/courses\/[^/]+$/.test(path), load: () => import("@/pages/course-details") },
  { matches: (path) => path.startsWith("/courses"), load: () => import("@/pages/courses") },
  { matches: (path) => /^\/projects\/[^/]+$/.test(path) && path !== "/projects/new", load: () => import("@/pages/projects/ProjectDetailPage") },
  { matches: (path) => path === "/projects", load: () => import("@/pages/projects/ProjectsPage") },
  { matches: (path) => /^\/hackathons\/[^/]+/.test(path), load: () => import("@/pages/hackathon-detail/ContestPublicLayout") },
  { matches: (path) => path === "/hackathons", load: () => import("@/pages/hackathon-detail/Contests") },
  { matches: (path) => path.startsWith("/jobs/market"), load: () => import("@/pages/jobs/JobMarketPage") },
  { matches: (path) => path.startsWith("/jobs/saved") || path.startsWith("/jobs/applied") || path.startsWith("/jobs/hidden"), load: () => import("@/pages/jobs/UserJobsPage") },
  { matches: (path) => /^\/jobs\/[^/]+/.test(path), load: () => import("@/pages/jobs/JobDetailPage") },
  { matches: (path) => path.startsWith("/jobs"), load: () => import("@/pages/jobs/JobsPage") },
  { matches: (path) => path.startsWith("/login"), load: () => import("@/pages/login/Auth") },
  { matches: (path) => path.startsWith("/account"), load: () => import("@/pages/account/Account") },
  { matches: (path) => path.startsWith("/achievements"), load: () => import("@/pages/achievements") },
  { matches: (path) => path.startsWith("/instructor"), load: () => import("@/pages/instructor/InstructorLayout") },
  { matches: (path) => path.startsWith("/admin"), load: () => import("@/pages/admin/AdminLayout") },
];

const pendingOrLoaded = new Set<() => Promise<unknown>>();

export function canSpeculativelyPrefetch(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (
    navigator as Navigator & { connection?: NetworkInformationLike }
  ).connection;
  if (connection?.saveData) return false;
  return connection?.effectiveType !== "slow-2g" && connection?.effectiveType !== "2g";
}

/** Warm only the chunk for the destination; callers decide which route data is safe to prefetch. */
export function prefetchRouteChunk(pathname: string): void {
  if (!canSpeculativelyPrefetch()) return;
  const route = routeLoaders.find((candidate) => candidate.matches(pathname));
  if (!route || pendingOrLoaded.has(route.load)) return;
  pendingOrLoaded.add(route.load);
  void route.load().catch(() => {
    pendingOrLoaded.delete(route.load);
  });
}

const STANDALONE_ROUTE = /^\/(login|confirm-signup|auth|ocid-redirect|email|claim|verify|components|learn)(\/|$)/;

/**
 * Route chunks only load once auth boot mounts the router. Fetch the entry URL's layout and page
 * chunks during boot instead, so the first visit does not wait for a second download round.
 * Not speculative: the visitor is already on this URL.
 */
export function preloadEntryRoute(pathname: string): void {
  const path = pathname.replace(/\/+$/, "") || "/";
  const loads: Array<Promise<unknown>> = [];
  if (/^\/study\/[^/]+/.test(path)) {
    loads.push(import("@/pages/learn/LearnLayout"), import("@/pages/learn"));
  } else {
    if (!STANDALONE_ROUTE.test(path)) loads.push(import("@/components/layouts/MainLayout"));
    const route = routeLoaders.find((candidate) => candidate.matches(path));
    if (route) {
      pendingOrLoaded.add(route.load);
      loads.push(route.load().catch((error: unknown) => {
        pendingOrLoaded.delete(route.load);
        throw error;
      }));
    }
  }
  // A failed preload is retried by React.lazy when the route renders.
  for (const load of loads) void load.catch(() => undefined);
}
