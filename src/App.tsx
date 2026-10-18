import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LoadingBar } from "@/components/ui/LoadingBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
import { AppShellSkeleton } from "@/components/loading/AppShellSkeleton";
import { RouteSkeleton } from "@/components/loading/RouteSkeleton";
import { markClientNavigation } from "@/components/loading/skeletonReveal";
import { LocationPlaceholder, RoutePlaceholder } from "@/routePlaceholders";
import MaintenancePage from "@/pages/MaintenancePage";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { ThemeProvider } from "next-themes";
import { NotificationSync } from "@/features/notifications/NotificationSync";
import { XpNotifications } from "@/features/xp/XpNotifications";
import { AuthSync } from "@/components/auth/AuthSync";
import { AuthBootstrapScreen } from "@/components/auth/AuthBootstrapScreen";
import CredentialRealtimeSync from "@/components/base/CredentialRealtimeSync";
import { PendingCredentialsWelcomeModal } from "@/components/base/PendingCredentialsWelcomeModal";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import { ROLE_GROUPS } from "@/config/roles";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { ScrollToTop } from "@/components/navigation/ScrollToTop";
import {
  PageTitleProvider,
  RoutePageTitleSync,
} from "@/components/navigation/PageTitle";
import { APP_BASE_PATH, currentAppPathname } from "@/lib/appUrl";

// Lazy-load all routes not needed on the initial render
const Home = lazy(() => import("@/pages/home/index"));
const NotificationsPage = lazy(() => import("@/pages/notifications/NotificationsPage"));
const FeedPage = lazy(() => import("@/pages/feed/FeedPage"));
const Courses = lazy(() => import("@/pages/courses"));
const LearningPrinciplesPage = lazy(() => import("@/pages/learning-principles/LearningPrinciplesPage"));
const Auth = lazy(() => import("@/pages/login/Auth"));
const OCIDRedirect = lazy(() => import("@/pages/OCIDRedirect"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const MainLayout = lazy(() => import("@/components/layouts/MainLayout"));
const CourseDetail = lazy(() => import("@/pages/course-details"));
const Learn = lazy(() => import("@/pages/learn"));
const LearnLayout = lazy(() => import("@/pages/learn/LearnLayout"));
const LegacyLearnRedirect = lazy(() => import("@/pages/learn/LegacyLearnRedirect"));
const InstructorDetail = lazy(() => import("@/pages/InstructorDetail"));
const ProjectInvitePage = lazy(() => import("@/pages/invites/ProjectInvitePage"));
const CoInstructorInvitePage = lazy(() => import("@/pages/invites/CoInstructorInvitePage"));
const SearchPage = lazy(() => import("@/pages/search"));
const ConfirmSignup = lazy(() => import("@/pages/auth/ConfirmSignup"));
const SignupVerified = lazy(() => import("@/pages/auth/SignupVerified"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const EmailUnsubscribePage = lazy(() =>
  import("@/pages/EmailUnsubscribePage").then((m) => ({ default: m.EmailUnsubscribePage })),
);
const ClaimPage = lazy(() =>
  import("@/pages/claim/ClaimPage").then((m) => ({ default: m.ClaimPage })),
);
const VerifyCertificatePage = lazy(() =>
  import("@/pages/verify/VerifyCertificatePage").then((m) => ({ default: m.VerifyCertificatePage })),
);
const UserHandleRedirect = lazy(() => import("@/pages/users/UserHandleRedirect"));
const AchievementsPage = lazy(() => import("@/pages/achievements"));
const Hackathons = lazy(() => import("@/pages/hackathon-detail/Contests"));
const HackathonPublicLayout = lazy(() => {
  // Fetch the tab chunk alongside the layout so tabs don't add another loading stage after it.
  void import("@/pages/hackathon-detail/ContestPublicTabs");
  return import("@/pages/hackathon-detail/ContestPublicLayout");
});
const HackathonOverviewTab = lazy(() => import("@/pages/hackathon-detail/ContestPublicTabs").then((m) => ({ default: m.HackathonOverviewTab })));
const HackathonPostsTab = lazy(() => import("@/pages/hackathon-detail/ContestPublicTabs").then((m) => ({ default: m.HackathonPostsTab })));
const HackathonPrizesTab = lazy(() => import("@/pages/hackathon-detail/ContestPublicTabs").then((m) => ({ default: m.HackathonPrizesTab })));
const HackathonTimelineTab = lazy(() => import("@/pages/hackathon-detail/ContestPublicTabs").then((m) => ({ default: m.HackathonTimelineTab })));
const HackathonResourcesTab = lazy(() => import("@/pages/hackathon-detail/ContestPublicTabs").then((m) => ({ default: m.HackathonResourcesTab })));
const HackathonProjectsTab = lazy(() => import("@/pages/hackathon-detail/ContestPublicTabs").then((m) => ({ default: m.HackathonProjectsTab })));
const ProjectsPage = lazy(() => import("@/pages/projects/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("@/pages/projects/ProjectDetailPage"));
const ProjectNewPage = lazy(() => import("@/pages/projects/ProjectNewPage"));
const ProjectEditPage = lazy(() => import("@/pages/projects/ProjectEditPage"));
const JobsPage = lazy(() => import("@/pages/jobs/JobsPage"));
const JobDetailPage = lazy(() => import("@/pages/jobs/JobDetailPage"));
const SavedJobsPage = lazy(() => import("@/pages/jobs/UserJobsPage").then((m) => ({ default: m.SavedJobsPage })));
const AppliedJobsPage = lazy(() => import("@/pages/jobs/UserJobsPage").then((m) => ({ default: m.AppliedJobsPage })));
const HiddenJobsPage = lazy(() => import("@/pages/jobs/UserJobsPage").then((m) => ({ default: m.HiddenJobsPage })));
const JobMarketPage = lazy(() => import("@/pages/jobs/JobMarketPage"));

const Account = lazy(() => import("@/pages/account/Account"));
const AccountProfileRoute = lazy(() =>
  import("@/pages/account/AccountProfileRoute").then((m) => ({ default: m.AccountProfileRoute })),
);
const AccountProjectsRoute = lazy(() =>
  import("@/pages/account/AccountProjectsRoute").then((m) => ({ default: m.AccountProjectsRoute })),
);
const AccountCvRoute = lazy(() =>
  import("@/pages/account/AccountCvRoute").then((m) => ({ default: m.AccountCvRoute })),
);
const AccountSettingsRoute = lazy(() =>
  import("@/pages/account/AccountSettingsRoute").then((m) => ({ default: m.AccountSettingsRoute })),
);
const AvatarSettingsRoute = lazy(() =>
  import("@/pages/account/AvatarSettingsRoute").then((m) => ({ default: m.AvatarSettingsRoute })),
);
const AccountInstructorProfileRoute = lazy(() =>
  import("@/pages/account/AccountInstructorRoutes").then((m) => ({
    default: m.AccountInstructorProfileRoute,
  })),
);
const InstructorWorkspaceProfileRoute = lazy(() =>
  import("@/pages/account/AccountInstructorRoutes").then((m) => ({
    default: m.InstructorWorkspaceProfileRoute,
  })),
);

const InstructorLayout = lazy(() => import("@/pages/instructor/InstructorLayout"));
const InstructorCourses = lazy(() => import("@/pages/InstructorCourses"));
const InstructorCourseNew = lazy(() => import("@/pages/instructor-course-new"));
const LearningPreview = lazy(() => import("@/pages/instructor-course-edit/LearningPreview"));
const InstructorCourseEdit = lazy(() => import("@/pages/instructor-course-edit"));

const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminInstructors = lazy(() => import("@/pages/admin/AdminInstructors"));
const AdminInstructorDetail = lazy(() => import("@/pages/admin/AdminInstructorDetail"));
const AdminActivityMilestones = lazy(() => import("@/pages/admin/AdminActivityMilestones"));
const AdminManualMint = lazy(() => import("@/pages/admin/AdminManualMint"));
const AdminBranding = lazy(() => import("@/pages/admin/AdminBranding"));
const AdminHackathons = lazy(() => import("@/pages/admin/hackathons/AdminHackathonsPage"));
const AdminHackathonEditor = lazy(() => import("@/pages/admin/hackathons/AdminHackathonEditorPage"));
const AdminProjectsPage = lazy(() => import("@/pages/admin/AdminProjectsPage"));
const AdminJobsPage = lazy(() => import("@/pages/admin/jobs/AdminJobsPage"));
const AdminComponentsPage = lazy(() => import("@/pages/admin/AdminComponentsPage"));
const AdminEmailCenterPage = lazy(() => import("@/pages/admin/email/AdminEmailCenterPage"));
const AdminCertificateAnalytics = lazy(() => import("@/pages/admin/AdminCertificateAnalytics"));
const AdminEmailPreviewPage = lazy(() => import("@/pages/admin/email/AdminEmailPreviewPage"));
const AdminOgPreviewPage = lazy(() => import("@/pages/admin/AdminOgPreviewPage"));

const PageFallback = () => <AuthGateLoading />;
const ShellFallback = () => (
  <AppShellSkeleton>
    <LocationPlaceholder />
  </AppShellSkeleton>
);
const HomeFallback = () => <RouteSkeleton variant="home" />;
const ListFallback = () => <RouteSkeleton variant="list" />;
const DetailFallback = () => <RouteSkeleton variant="detail" />;
const FormFallback = () => <RouteSkeleton variant="form" />;
const TableFallback = () => <RouteSkeleton variant="table" />;
const AccountFormFallback = () => <RouteSkeleton variant="form" bare />;
const AccountListFallback = () => <RouteSkeleton variant="list" bare />;
// Hackathon tabs render under the already-visible contest header; their chunk is prefetched
// with the layout, so a placeholder here would only add a second skeleton for React's ~300ms
// Suspense reveal throttle.
const TabFallback = () => null;
const LearnFallback = () => <RouteSkeleton variant="learn" className="h-dvh" />;

function RecoveryGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery);

  useEffect(() => {
    if (isPasswordRecovery && location.pathname !== "/auth/reset-password") {
      void navigate("/auth/reset-password", { replace: true });
    }
  }, [isPasswordRecovery, location.pathname, navigate]);

  return null;
}

export default function App() {
  const { i18n } = useTranslation();
  const authStatus = useAuthStore((s) => s.status);

  useEffect(() => {
    document.documentElement.lang =
      i18n.resolvedLanguage ?? i18n.language ?? "vi";
  }, [i18n.resolvedLanguage, i18n.language]);

  if (import.meta.env.VITE_MAINTENANCE_MODE === "true") {
    return (
      <PageTitleProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MaintenancePage />
        </ThemeProvider>
      </PageTitleProvider>
    );
  }

  return (
    <PageTitleProvider>
      <ErrorBoundary>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LoadingBar />
          <Toaster />
          <AuthSync />
          <XpNotifications />
          <NotificationSync />
          {authStatus === "booting" ? (
            <AuthBootstrapScreen content={<RoutePlaceholder pathname={currentAppPathname()} />} />
          ) : (
            <TooltipProvider>
              <ApplicationRouter />
            </TooltipProvider>
          )}
        </ThemeProvider>
      </ErrorBoundary>
    </PageTitleProvider>
  );
}


// Keep the existing descendant route tree while enabling supported navigation
// blockers (including browser Back/Forward) in authoring workspaces.
function ApplicationRouter() {
  const [router] = useState(() => {
    const instance = createBrowserRouter(
      [{ path: "*", element: <ApplicationRoutes />, errorElement: <RouteErrorBoundary /> }],
      { basename: APP_BASE_PATH || "/" },
    );
    // Subscribed before RouterProvider, so the flag is set before the next route renders.
    const initialKey = instance.state.location.key;
    const unsubscribe = instance.subscribe((state) => {
      if (state.location.key !== initialKey) {
        markClientNavigation();
        unsubscribe();
      }
    });
    return instance;
  });
  return <RouterProvider router={router} />;
}

function ApplicationRoutes() {
  return <>
          <RoutePageTitleSync />
          <CredentialRealtimeSync />
          <ScrollToTop />
          <RecoveryGuard />
          <PendingCredentialsWelcomeModal />
          <Routes>
            <Route
              path="/login"
              element={
                <Suspense fallback={<LocationPlaceholder />}>
                  <Auth />
                </Suspense>
              }
            />
            <Route
              path="/confirm-signup"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ConfirmSignup />
                </Suspense>
              }
            />
            <Route
              path="/auth/signup-verified"
              element={
                <Suspense fallback={<PageFallback />}>
                  <SignupVerified />
                </Suspense>
              }
            />
            <Route
              path="/auth/reset-password"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ResetPasswordPage />
                </Suspense>
              }
            />
            <Route
              path="/ocid-redirect"
              element={
                <Suspense fallback={<LocationPlaceholder />}>
                  <OCIDRedirect />
                </Suspense>
              }
            />
            <Route
              path="/email/unsubscribe"
              element={
                <Suspense fallback={<PageFallback />}>
                  <EmailUnsubscribePage />
                </Suspense>
              }
            />
            <Route
              path="/claim"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ClaimPage />
                </Suspense>
              }
            />
            <Route
              path="/verify/:code"
              element={
                <Suspense fallback={<PageFallback />}>
                  <VerifyCertificatePage />
                </Suspense>
              }
            />
            <Route
              path="/verify"
              element={
                <Suspense fallback={<PageFallback />}>
                  <VerifyCertificatePage />
                </Suspense>
              }
            />
            <Route path="learn/*" element={<Suspense fallback={<LearnFallback />}><LegacyLearnRedirect /></Suspense>} />
            <Route
              path="study"
              element={
                <Suspense fallback={<LearnFallback />}>
                  <LearnLayout />
                </Suspense>
              }
            >
              <Route
                path=":courseId"
                element={
                  <Suspense fallback={<LearnFallback />}>
                    <Learn />
                  </Suspense>
                }
              />
              <Route
                path=":courseId/final-assignment"
                element={<Suspense fallback={<LearnFallback />}><Learn /></Suspense>}
              />
              <Route
                path=":courseId/lesson/:lessonId"
                element={
                  <Suspense fallback={<LearnFallback />}>
                    <Learn />
                  </Suspense>
                }
              />
            </Route>
            <Route
              path="/components"
              element={
                <RequireRole roles={ROLE_GROUPS.projectModerators}>
                  <Suspense fallback={<PageFallback />}>
                    <AdminComponentsPage />
                  </Suspense>
                </RequireRole>
              }
            />
            <Route
              path="/components/full-page-empty-state"
              element={
                <RequireRole roles={ROLE_GROUPS.projectModerators}>
                  <Suspense fallback={<PageFallback />}>
                    <AdminComponentsPage />
                  </Suspense>
                </RequireRole>
              }
            />
            {[
              "action",
              "avatar",
              "badge",
              "tag",
              "selection",
              "toggle",
              "separator",
              "scrollbar",
              "tabs",
              "dropdown-menu",
              "input-field",
              "button",
              "empty-state-illustration",
              "progress",
              "xp-rank",
              "timestamp",
              "tooltip",
              "stepper",
              "informative-icon",
            ].map((component) => (
              <Route
                key={component}
                path={`/components/${component}`}
                element={
                  <RequireRole roles={ROLE_GROUPS.projectModerators}>
                    <Suspense fallback={<PageFallback />}>
                      <AdminComponentsPage />
                    </Suspense>
                  </RequireRole>
                }
              />
            ))}
            <Route
              path="/"
              element={
                <Suspense fallback={<ShellFallback />}>
                  <MainLayout />
                </Suspense>
              }
            >
              <Route
                index
                element={
                  <Suspense fallback={<HomeFallback />}>
                    <Home />
                  </Suspense>
                }
              />
              <Route path="notifications" element={<RequireAuth><Suspense fallback={<ListFallback />}><NotificationsPage /></Suspense></RequireAuth>} />
              <Route
                path="feed"
                element={
                  <RequireAuth>
                    <Suspense fallback={<ListFallback />}>
                      <FeedPage />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="leaderboard"
                element={<Navigate to="/feed?tab=leaderboard" replace />}
              />
              <Route
                path="courses"
                element={
                  <Suspense fallback={<LocationPlaceholder />}>
                    <Courses />
                  </Suspense>
                }
              />
              <Route
                path="invites/project/:token"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ProjectInvitePage />
                  </Suspense>
                }
              />
              <Route
                path="invites/co-instructor/:token"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CoInstructorInvitePage />
                  </Suspense>
                }
              />
              <Route path="cohorts" element={<Navigate to="/courses" replace />} />
              <Route path="learning-principles" element={<Suspense fallback={<PageFallback />}><LearningPrinciplesPage /></Suspense>} />
              <Route
                path="courses/:id"
                element={
                  <Suspense fallback={<LocationPlaceholder />}>
                    <CourseDetail />
                  </Suspense>
                }
              />
              <Route path="cohorts/:id" element={<Navigate to="/courses" replace />} />
              <Route
                path="instructors/:id"
                element={
                  <Suspense fallback={<DetailFallback />}>
                    <InstructorDetail />
                  </Suspense>
                }
              />
              <Route
                path="achievements"
                element={
                  <RequireAuth>
                    <Suspense fallback={<ListFallback />}>
                      <AchievementsPage />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route path="hackathons" element={<Suspense fallback={<ListFallback />}><Hackathons /></Suspense>} />
              <Route path="hackathons/manage/*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
              <Route path="hackathons/new" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
              <Route path="hackathons/:slug/manage/*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
              <Route path="hackathons/:slug" element={<Suspense fallback={<LocationPlaceholder />}><HackathonPublicLayout /></Suspense>}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<Suspense fallback={<TabFallback />}><HackathonOverviewTab /></Suspense>} />
                <Route path="posts" element={<Suspense fallback={<TabFallback />}><HackathonPostsTab /></Suspense>} />
                <Route path="prizes" element={<Suspense fallback={<TabFallback />}><HackathonPrizesTab /></Suspense>} />
                <Route path="timeline" element={<Suspense fallback={<TabFallback />}><HackathonTimelineTab /></Suspense>} />
                <Route path="resources" element={<Suspense fallback={<TabFallback />}><HackathonResourcesTab /></Suspense>} />
                <Route path="projects" element={<Suspense fallback={<TabFallback />}><HackathonProjectsTab /></Suspense>} />
              </Route>
              <Route path="projects" element={<Suspense fallback={<ListFallback />}><ProjectsPage /></Suspense>} />
              <Route path="projects/new" element={<RequireAuth><Suspense fallback={<FormFallback />}><ProjectNewPage /></Suspense></RequireAuth>} />
              <Route path="projects/:slug/edit" element={<RequireAuth><Suspense fallback={<FormFallback />}><ProjectEditPage /></Suspense></RequireAuth>} />
              <Route path="projects/:slug" element={<Suspense fallback={<LocationPlaceholder />}><ProjectDetailPage /></Suspense>} />
              <Route path="jobs" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/saved" element={<RequireAuth><Suspense fallback={<ListFallback />}><SavedJobsPage /></Suspense></RequireAuth>} />
              <Route path="jobs/applied" element={<RequireAuth><Suspense fallback={<ListFallback />}><AppliedJobsPage /></Suspense></RequireAuth>} />
              <Route path="jobs/hidden" element={<RequireAuth><Suspense fallback={<ListFallback />}><HiddenJobsPage /></Suspense></RequireAuth>} />
              <Route path="jobs/market" element={<Suspense fallback={<ListFallback />}><JobMarketPage /></Suspense>} />
              <Route path="jobs/market/skills/:skill" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/market/roles/:role" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/market/entry-level" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/market/remote" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/frontend" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/backend" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/ai-engineering" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/devops" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/skills/:skill" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/domains/:domain" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/remote" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/vietnam" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/apac" element={<Suspense fallback={<ListFallback />}><JobsPage /></Suspense>} />
              <Route path="jobs/:slug" element={<Suspense fallback={<DetailFallback />}><JobDetailPage /></Suspense>} />
              <Route
                path="search"
                element={
                  <Suspense fallback={<ListFallback />}>
                    <SearchPage />
                  </Suspense>
                }
              />
              <Route
                path="u/:handle/*"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <UserHandleRedirect />
                  </Suspense>
                }
              />
              <Route
                path="account"
                element={
                  <RequireAuth>
                    <Suspense fallback={<LocationPlaceholder />}>
                      <Account />
                    </Suspense>
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="profile" replace />} />
                <Route
                  path="profile"
                  element={
                    <Suspense fallback={<AccountFormFallback />}>
                      <AccountProfileRoute />
                    </Suspense>
                  }
                />
                <Route
                  path="cv"
                  element={
                    <Suspense fallback={<AccountFormFallback />}>
                      <AccountCvRoute />
                    </Suspense>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <Suspense fallback={<AccountFormFallback />}>
                      <AccountSettingsRoute />
                    </Suspense>
                  }
                />
                <Route path="projects" element={<Suspense fallback={<AccountListFallback />}><AccountProjectsRoute /></Suspense>} />
                <Route
                  path="instructor"
                  element={
                    <Suspense fallback={<AccountFormFallback />}>
                      <AccountInstructorProfileRoute />
                    </Suspense>
                  }
                />
              </Route>
              <Route path="settings/avatar" element={<RequireAuth><Suspense fallback={<FormFallback />}><AvatarSettingsRoute /></Suspense></RequireAuth>} />
              <Route
                path="admin"
                element={
                  <RequireRole roles={ROLE_GROUPS.admin} loadingFallback={<LocationPlaceholder />}>
                    <Suspense fallback={<LocationPlaceholder />}>
                      <AdminLayout />
                    </Suspense>
                  </RequireRole>
                }
              >
                <Route
                  index
                  element={
                    <Suspense fallback={<TableFallback />}>
                      <AdminUsers />
                    </Suspense>
                  }
                />
                <Route
                  path="instructors"
                  element={
                    <Suspense fallback={<TableFallback />}>
                      <AdminInstructors />
                    </Suspense>
                  }
                />
                <Route
                  path="instructors/:id"
                  element={
                    <Suspense fallback={<DetailFallback />}>
                      <AdminInstructorDetail />
                    </Suspense>
                  }
                />
                <Route
                  path="activity-milestones"
                  element={
                    <Suspense fallback={<TableFallback />}>
                      <AdminActivityMilestones />
                    </Suspense>
                  }
                />
                <Route
                  path="manual-mint"
                  element={
                    <Suspense fallback={<TableFallback />}>
                      <AdminManualMint />
                    </Suspense>
                  }
                />
                <Route
                  path="certificates"
                  element={<RequireRole roles={ROLE_GROUPS.adminOnly} loadingFallback={<LocationPlaceholder withLayoutChrome={false} />}><Suspense fallback={<TableFallback />}><AdminCertificateAnalytics /></Suspense></RequireRole>}
                />
                <Route
                  path="branding"
                  element={
                    <Suspense fallback={<FormFallback />}>
                      <AdminBranding />
                    </Suspense>
                  }
                />
                <Route path="hackathons" element={<Suspense fallback={<TableFallback />}><AdminHackathons /></Suspense>} />
                <Route path="hackathons/new" element={<Suspense fallback={<FormFallback />}><AdminHackathonEditor /></Suspense>} />
                <Route path="hackathons/:id/edit" element={<Suspense fallback={<FormFallback />}><AdminHackathonEditor /></Suspense>} />
                <Route path="projects" element={<RequireRole roles={ROLE_GROUPS.projectManagers} loadingFallback={<LocationPlaceholder withLayoutChrome={false} />}><Suspense fallback={<TableFallback />}><AdminProjectsPage /></Suspense></RequireRole>} />
                <Route path="jobs" element={<Suspense fallback={<TableFallback />}><AdminJobsPage /></Suspense>} />
                <Route path="jobs/review" element={<Suspense fallback={<TableFallback />}><AdminJobsPage /></Suspense>} />
                <Route path="jobs/sources" element={<Suspense fallback={<TableFallback />}><AdminJobsPage /></Suspense>} />
                <Route path="jobs/companies" element={<Suspense fallback={<TableFallback />}><AdminJobsPage /></Suspense>} />
                <Route path="jobs/crawlers" element={<Suspense fallback={<TableFallback />}><AdminJobsPage /></Suspense>} />
                <Route path="jobs/analytics" element={<Suspense fallback={<TableFallback />}><AdminJobsPage /></Suspense>} />
                <Route path="email/previews" element={<Suspense fallback={<PageFallback />}><AdminEmailPreviewPage /></Suspense>} />
                <Route path="og-preview" element={<Suspense fallback={<PageFallback />}><AdminOgPreviewPage /></Suspense>} />
                <Route path="email" element={<Suspense fallback={<TableFallback />}><AdminEmailCenterPage /></Suspense>} />
              </Route>
              <Route
                path="instructor"
                element={
                  <RequireRole roles={ROLE_GROUPS.instructorWorkspace} loadingFallback={<LocationPlaceholder />}>
                    <Suspense fallback={<LocationPlaceholder />}>
                      <InstructorLayout />
                    </Suspense>
                  </RequireRole>
                }
              >
                <Route
                  path="courses"
                  element={
                    <Suspense fallback={<LocationPlaceholder withLayoutChrome={false} />}>
                      <InstructorCourses />
                    </Suspense>
                  }
                />
                <Route
                  path="cohorts"
                  element={<Navigate to="/instructor/courses" replace />}
                />
                <Route
                  path="cohorts/new"
                  element={<Navigate to="/instructor/courses" replace />}
                />
                <Route
                  path="cohorts/:id/manage"
                  element={<Navigate to="/instructor/courses" replace />}
                />
                <Route
                  path="courses/new"
                  element={
                    <Suspense fallback={<FormFallback />}>
                      <InstructorCourseNew />
                    </Suspense>
                  }
                />
                <Route path="courses/:id/preview/:lessonId?" element={<Suspense fallback={<PageFallback />}><LearningPreview /></Suspense>} />
                <Route
                  path="courses/:id/edit"
                  element={
                    <Suspense fallback={<FormFallback />}>
                      <InstructorCourseEdit />
                    </Suspense>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <Suspense fallback={<FormFallback />}>
                      <InstructorWorkspaceProfileRoute />
                    </Suspense>
                  }
                />
                <Route
                  path="instructors"
                  element={
                    <RequireRole roles={ROLE_GROUPS.admin} loadingFallback={<LocationPlaceholder withLayoutChrome={false} />}>
                      <Navigate to="/admin/instructors" replace />
                    </RequireRole>
                  }
                />
              </Route>
              <Route
                path="learning-path/*"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <NotFound />
                  </Suspense>
                }
              />
              <Route
                path=":handle/*"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <UserHandleRedirect />
                  </Suspense>
                }
              />
              <Route
                path="*"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <NotFound />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
</>;
}
