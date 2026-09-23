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
  { matches: (path) => path.startsWith("/courses"), load: () => import("@/pages/courses") },
  { matches: (path) => path.startsWith("/career"), load: () => import("@/pages/career") },
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
