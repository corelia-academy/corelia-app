import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { matchRoutes, useLocation } from "react-router";

const BRAND_NAME = "Corelia Academy";

export type PageTitleKey =
  | "home"
  | "login"
  | "confirmSignup"
  | "signupVerified"
  | "resetPassword"
  | "connectingAccount"
  | "unsubscribe"
  | "claimCertificate"
  | "verifyCertificate"
  | "learnCourse"
  | "learnLesson"
  | "finalAssignment"
  | "componentLibrary"
  | "feed"
  | "leaderboard"
  | "courses"
  | "courseDetail"
  | "projectInvite"
  | "coInstructorInvite"
  | "careerTracks"
  | "careerTrackDetail"
  | "instructorDetail"
  | "achievements"
  | "hackathons"
  | "hackathonOverview"
  | "hackathonPrizes"
  | "hackathonTimeline"
  | "hackathonResources"
  | "hackathonProjects"
  | "projects"
  | "newProject"
  | "editProject"
  | "projectDetail"
  | "jobs"
  | "savedJobs"
  | "appliedJobs"
  | "hiddenJobs"
  | "jobMarket"
  | "jobDetail"
  | "search"
  | "publicProfile"
  | "accountProfile"
  | "accountCv"
  | "accountSettings"
  | "accountProjects"
  | "instructorProfile"
  | "users"
  | "instructors"
  | "instructorReview"
  | "activityMilestones"
  | "manualMint"
  | "branding"
  | "manageHackathons"
  | "newHackathon"
  | "editHackathon"
  | "manageProjects"
  | "manageJobs"
  | "reviewJobs"
  | "jobSources"
  | "companies"
  | "crawlers"
  | "jobAnalytics"
  | "emailCenter"
  | "teaching"
  | "manageCourses"
  | "manageCareerTracks"
  | "newCareerTrack"
  | "editCareerTrack"
  | "newCourse"
  | "previewCourse"
  | "editCourse"
  | "notFound"
  | "maintenance"
  | "applicationError";

interface PageTitleRoute {
  path: string;
  handle: PageTitleKey;
}

/**
 * Browser-title routes mirror App.tsx. React Router ranks static segments ahead
 * of dynamic ones, so /projects/new never resolves as /projects/:slug.
 */
// Exported for route-coverage tests.
// eslint-disable-next-line react-refresh/only-export-components
export const PAGE_TITLE_ROUTES: PageTitleRoute[] = [
  { path: "/login", handle: "login" },
  { path: "/confirm-signup", handle: "confirmSignup" },
  { path: "/auth/signup-verified", handle: "signupVerified" },
  { path: "/auth/reset-password", handle: "resetPassword" },
  { path: "/ocid-redirect", handle: "connectingAccount" },
  { path: "/email/unsubscribe", handle: "unsubscribe" },
  { path: "/claim", handle: "claimCertificate" },
  { path: "/verify/:code", handle: "verifyCertificate" },
  { path: "/verify", handle: "verifyCertificate" },
  { path: "/learn/:courseId/final-assignment", handle: "finalAssignment" },
  { path: "/learn/:courseId/lesson/:lessonId", handle: "learnLesson" },
  { path: "/learn/:courseId", handle: "learnCourse" },
  { path: "/components/*", handle: "componentLibrary" },
  { path: "/", handle: "home" },
  { path: "/feed", handle: "feed" },
  { path: "/leaderboard", handle: "leaderboard" },
  { path: "/courses", handle: "courses" },
  { path: "/cohorts", handle: "courses" },
  { path: "/courses/:id", handle: "courseDetail" },
  { path: "/cohorts/:id", handle: "courses" },
  { path: "/invites/project/:token", handle: "projectInvite" },
  { path: "/invites/co-instructor/:token", handle: "coInstructorInvite" },
  { path: "/career", handle: "careerTracks" },
  { path: "/career/:slug", handle: "careerTrackDetail" },
  { path: "/instructors/:id", handle: "instructorDetail" },
  { path: "/achievements", handle: "achievements" },
  { path: "/hackathons", handle: "hackathons" },
  { path: "/hackathons/manage/*", handle: "notFound" },
  { path: "/hackathons/new", handle: "notFound" },
  { path: "/hackathons/:slug/manage/*", handle: "notFound" },
  { path: "/hackathons/:slug/overview", handle: "hackathonOverview" },
  { path: "/hackathons/:slug/prizes", handle: "hackathonPrizes" },
  { path: "/hackathons/:slug/timeline", handle: "hackathonTimeline" },
  { path: "/hackathons/:slug/resources", handle: "hackathonResources" },
  { path: "/hackathons/:slug/projects", handle: "hackathonProjects" },
  { path: "/hackathons/:slug", handle: "hackathonOverview" },
  { path: "/projects", handle: "projects" },
  { path: "/projects/new", handle: "newProject" },
  { path: "/projects/:slug/edit", handle: "editProject" },
  { path: "/projects/:slug", handle: "projectDetail" },
  { path: "/jobs", handle: "jobs" },
  { path: "/jobs/saved", handle: "savedJobs" },
  { path: "/jobs/applied", handle: "appliedJobs" },
  { path: "/jobs/hidden", handle: "hiddenJobs" },
  { path: "/jobs/market", handle: "jobMarket" },
  { path: "/jobs/market/skills/:skill", handle: "jobs" },
  { path: "/jobs/market/roles/:role", handle: "jobs" },
  { path: "/jobs/market/entry-level", handle: "jobs" },
  { path: "/jobs/market/remote", handle: "jobs" },
  { path: "/jobs/frontend", handle: "jobs" },
  { path: "/jobs/backend", handle: "jobs" },
  { path: "/jobs/ai-engineering", handle: "jobs" },
  { path: "/jobs/devops", handle: "jobs" },
  { path: "/jobs/skills/:skill", handle: "jobs" },
  { path: "/jobs/domains/:domain", handle: "jobs" },
  { path: "/jobs/remote", handle: "jobs" },
  { path: "/jobs/vietnam", handle: "jobs" },
  { path: "/jobs/apac", handle: "jobs" },
  { path: "/jobs/:slug", handle: "jobDetail" },
  { path: "/search", handle: "search" },
  { path: "/u/:handle/*", handle: "publicProfile" },
  { path: "/account/profile", handle: "accountProfile" },
  { path: "/account/cv", handle: "accountCv" },
  { path: "/account/settings", handle: "accountSettings" },
  { path: "/account/projects", handle: "accountProjects" },
  { path: "/account/instructor", handle: "instructorProfile" },
  { path: "/account", handle: "accountProfile" },
  { path: "/admin", handle: "users" },
  { path: "/admin/instructors", handle: "instructors" },
  { path: "/admin/instructors/:id", handle: "instructorReview" },
  { path: "/admin/activity-milestones", handle: "activityMilestones" },
  { path: "/admin/manual-mint", handle: "manualMint" },
  { path: "/admin/branding", handle: "branding" },
  { path: "/admin/hackathons", handle: "manageHackathons" },
  { path: "/admin/hackathons/new", handle: "newHackathon" },
  { path: "/admin/hackathons/:id/edit", handle: "editHackathon" },
  { path: "/admin/projects", handle: "manageProjects" },
  { path: "/admin/jobs", handle: "manageJobs" },
  { path: "/admin/jobs/review", handle: "reviewJobs" },
  { path: "/admin/jobs/sources", handle: "jobSources" },
  { path: "/admin/jobs/companies", handle: "companies" },
  { path: "/admin/jobs/crawlers", handle: "crawlers" },
  { path: "/admin/jobs/analytics", handle: "jobAnalytics" },
  { path: "/admin/email", handle: "emailCenter" },
  { path: "/instructor", handle: "teaching" },
  { path: "/instructor/courses", handle: "manageCourses" },
  { path: "/instructor/cohorts", handle: "manageCourses" },
  { path: "/instructor/cohorts/new", handle: "manageCourses" },
  { path: "/instructor/cohorts/:id/manage", handle: "manageCourses" },
  { path: "/instructor/career-tracks", handle: "manageCareerTracks" },
  { path: "/instructor/career-tracks/new", handle: "newCareerTrack" },
  { path: "/instructor/career-tracks/:id/edit", handle: "editCareerTrack" },
  { path: "/instructor/courses/new", handle: "newCourse" },
  { path: "/instructor/courses/:id/preview/:lessonId?", handle: "previewCourse" },
  { path: "/instructor/courses/:id/edit", handle: "editCourse" },
  { path: "/instructor/profile", handle: "instructorProfile" },
  { path: "/instructor/instructors", handle: "instructors" },
  { path: "/learning-path/*", handle: "notFound" },
  { path: "/:handle/*", handle: "publicProfile" },
  { path: "*", handle: "notFound" },
];

// eslint-disable-next-line react-refresh/only-export-components
export function resolvePageTitleKey(pathname: string): PageTitleKey {
  const match = matchRoutes(PAGE_TITLE_ROUTES, pathname)?.at(-1);
  return match?.route.handle ?? "notFound";
}

interface PageTitleContextValue {
  setRouteKey: (key: PageTitleKey) => void;
  setOverride: (id: symbol, value: PageTitleOverrideValue | null) => void;
}

type PageTitleOverrideValue =
  | { key: PageTitleKey; title?: never }
  | { key?: never; title: string };

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const [routeKey, setRouteKey] = useState<PageTitleKey>(() =>
    typeof window === "undefined" ? "home" : resolvePageTitleKey(window.location.pathname),
  );
  const [overrides, setOverrides] = useState<Map<symbol, PageTitleOverrideValue>>(() => new Map());
  const setOverride = useCallback((id: symbol, override: PageTitleOverrideValue | null) => {
    setOverrides((current) => {
      const next = new Map(current);
      if (override) next.set(id, override);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ setRouteKey, setOverride }),
    [setOverride],
  );
  const activeOverride = Array.from(overrides.values()).at(-1);
  const translatedTitle = activeOverride?.title
    ?? t(`pageTitles.${activeOverride?.key ?? routeKey}`);

  useLayoutEffect(() => {
    const suffix = ` · ${BRAND_NAME}`;
    const baseTitle = translatedTitle.trim();
    document.title = baseTitle.endsWith(suffix) ? baseTitle : `${baseTitle}${suffix}`;
  }, [translatedTitle]);

  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}

function usePageTitleContext() {
  return useContext(PageTitleContext);
}

export function RoutePageTitleSync() {
  const { pathname } = useLocation();
  const context = usePageTitleContext();
  const key = resolvePageTitleKey(pathname);

  useLayoutEffect(() => {
    context?.setRouteKey(key);
  }, [context, key]);

  return null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePageTitleOverride(key: PageTitleKey | null) {
  const context = usePageTitleContext();
  const id = useRef(Symbol("page-title-override"));

  useLayoutEffect(() => {
    const overrideId = id.current;
    context?.setOverride(overrideId, key ? { key } : null);
    return () => context?.setOverride(overrideId, null);
  }, [context, key]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDynamicPageTitle(title: string | null | undefined) {
  const context = usePageTitleContext();
  const id = useRef(Symbol("dynamic-page-title"));
  const normalizedTitle = title?.trim() || null;

  useLayoutEffect(() => {
    const overrideId = id.current;
    context?.setOverride(overrideId, normalizedTitle ? { title: normalizedTitle } : null);
    return () => context?.setOverride(overrideId, null);
  }, [context, normalizedTitle]);
}

export function PageTitleOverride({ titleKey }: { titleKey: PageTitleKey }) {
  usePageTitleOverride(titleKey);
  return null;
}
