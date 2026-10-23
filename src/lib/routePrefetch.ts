import { routeChunk } from "@/lib/lazyRoute";

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

/** Route chunks shared by `App.tsx` (`lazyRoute`), entry preloading and hover prefetching. */
export const routeChunks = {
  mainLayout: routeChunk(() => import("@/components/layouts/MainLayout")),
  home: routeChunk(() => import("@/pages/home/index")),
  feed: routeChunk(() => import("@/pages/feed/FeedPage")),
  courses: routeChunk(() => import("@/pages/courses")),
  courseDetail: routeChunk(() => import("@/pages/course-details")),
  projects: routeChunk(() => import("@/pages/projects/ProjectsPage")),
  projectDetail: routeChunk(() => import("@/pages/projects/ProjectDetailPage")),
  hackathons: routeChunk(() => import("@/pages/hackathon-detail/Contests")),
  hackathonLayout: routeChunk(() => {
    // Fetch the tab chunk alongside the layout so tabs don't add another loading stage after it.
    void import("@/pages/hackathon-detail/ContestPublicTabs");
    return import("@/pages/hackathon-detail/ContestPublicLayout");
  }),
  learnLayout: routeChunk(() => import("@/pages/learn/LearnLayout")),
  learn: routeChunk(() => import("@/pages/learn")),
  jobs: routeChunk(() => import("@/pages/jobs/JobsPage")),
  jobDetail: routeChunk(() => import("@/pages/jobs/JobDetailPage")),
  jobMarket: routeChunk(() => import("@/pages/jobs/JobMarketPage")),
  login: routeChunk(() => import("@/pages/login/Auth")),
  account: routeChunk(() => import("@/pages/account/Account")),
  achievements: routeChunk(() => import("@/pages/achievements")),
  instructorLayout: routeChunk(() => import("@/pages/instructor/InstructorLayout")),
  adminLayout: routeChunk(() => import("@/pages/admin/AdminLayout")),
};

const routeLoaders: Array<{
  matches: (pathname: string) => boolean;
  load: () => Promise<unknown>;
}> = [
  { matches: (path) => path === "/", load: routeChunks.home.load },
  { matches: (path) => path.startsWith("/feed"), load: routeChunks.feed.load },
  { matches: (path) => /^\/courses\/[^/]+$/.test(path), load: routeChunks.courseDetail.load },
  { matches: (path) => path.startsWith("/courses"), load: routeChunks.courses.load },
  { matches: (path) => /^\/projects\/[^/]+$/.test(path) && path !== "/projects/new", load: routeChunks.projectDetail.load },
  { matches: (path) => path === "/projects", load: routeChunks.projects.load },
  { matches: (path) => /^\/hackathons\/[^/]+/.test(path), load: routeChunks.hackathonLayout.load },
  { matches: (path) => path === "/hackathons", load: routeChunks.hackathons.load },
  { matches: (path) => path.startsWith("/jobs/market"), load: routeChunks.jobMarket.load },
  { matches: (path) => path.startsWith("/jobs/saved") || path.startsWith("/jobs/applied") || path.startsWith("/jobs/hidden"), load: () => import("@/pages/jobs/UserJobsPage") },
  { matches: (path) => /^\/jobs\/[^/]+/.test(path), load: routeChunks.jobDetail.load },
  { matches: (path) => path.startsWith("/jobs"), load: routeChunks.jobs.load },
  { matches: (path) => path.startsWith("/login"), load: routeChunks.login.load },
  { matches: (path) => path.startsWith("/account"), load: routeChunks.account.load },
  { matches: (path) => path.startsWith("/achievements"), load: routeChunks.achievements.load },
  { matches: (path) => path.startsWith("/instructor"), load: routeChunks.instructorLayout.load },
  { matches: (path) => path.startsWith("/admin"), load: routeChunks.adminLayout.load },
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
    loads.push(routeChunks.learnLayout.load(), routeChunks.learn.load());
  } else {
    if (!STANDALONE_ROUTE.test(path)) loads.push(routeChunks.mainLayout.load());
    const route = routeLoaders.find((candidate) => candidate.matches(path));
    if (route) {
      pendingOrLoaded.add(route.load);
      loads.push(route.load().catch((error: unknown) => {
        pendingOrLoaded.delete(route.load);
        throw error;
      }));
    }
  }
  // A failed preload is retried when the route renders.
  for (const load of loads) void load.catch(() => undefined);
}
