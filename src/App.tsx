import { Suspense, lazy, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LoadingBar } from "@/components/ui/LoadingBar";
import { useLoadingStore } from "@/stores/loadingStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
import MaintenancePage from "@/pages/MaintenancePage";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { ThemeProvider } from "next-themes";
import { AuthSync } from "@/components/auth/AuthSync";
import CredentialRealtimeSync from "@/components/base/CredentialRealtimeSync";
import { PendingCredentialsWelcomeModal } from "@/components/base/PendingCredentialsWelcomeModal";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import { ROLE_GROUPS } from "@/config/roles";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";

// Lazy-load all routes not needed on the initial render
const Home = lazy(() => import("@/pages/home/index"));
const FeedPage = lazy(() => import("@/pages/feed/FeedPage"));
const Courses = lazy(() => import("@/pages/courses"));
const Auth = lazy(() => import("@/pages/login/Auth"));
const OCIDRedirect = lazy(() => import("@/pages/OCIDRedirect"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const MainLayout = lazy(() => import("@/components/layouts/MainLayout"));
const CourseDetail = lazy(() => import("@/pages/course-details"));
const Learn = lazy(() => import("@/pages/learn"));
const LearnLayout = lazy(() => import("@/pages/learn/LearnLayout"));
const InstructorDetail = lazy(() => import("@/pages/InstructorDetail"));
const RoadmapPage = lazy(() => import("@/pages/roadmap"));
const CareerList = lazy(() => import("@/pages/career"));
const CareerDetail = lazy(() => import("@/pages/career/CareerDetailPage"));
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

const Account = lazy(() => import("@/pages/account/Account"));
const AccountProfileRoute = lazy(() =>
  import("@/pages/account/AccountProfileRoute").then((m) => ({ default: m.AccountProfileRoute })),
);
const AccountCvRoute = lazy(() =>
  import("@/pages/account/AccountCvRoute").then((m) => ({ default: m.AccountCvRoute })),
);
const AccountSettingsRoute = lazy(() =>
  import("@/pages/account/AccountSettingsRoute").then((m) => ({ default: m.AccountSettingsRoute })),
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
const InstructorCourseEdit = lazy(() => import("@/pages/instructor-course-edit"));
const InstructorCareerTracks = lazy(() => import("@/pages/instructor-career-tracks"));
const InstructorCareerTrackEditor = lazy(
  () => import("@/pages/instructor-career-tracks/InstructorCareerTrackEditorPage"),
);

const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminInstructors = lazy(() => import("@/pages/admin/AdminInstructors"));
const AdminInstructorDetail = lazy(() => import("@/pages/admin/AdminInstructorDetail"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminActivityMilestones = lazy(() => import("@/pages/admin/AdminActivityMilestones"));
const AdminManualMint = lazy(() => import("@/pages/admin/AdminManualMint"));
const AdminBranding = lazy(() => import("@/pages/admin/AdminBranding"));

const PageFallback = () => <AuthGateLoading />;

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

function ScrollToTop() {
  const location = useLocation();
  const prevRef = useRef<{ pathname: string; hash: string } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = {
      pathname: location.pathname,
      hash: location.hash,
    };

    if (
      prev &&
      prev.pathname === location.pathname &&
      prev.hash !== location.hash
    ) {
      return;
    }

    const manageBaseRe = /^\/hackathons\/([^/]+)\/manage(?:\/|$)/;
    const prevManage = prev?.pathname.match(manageBaseRe);
    const nextManage = location.pathname.match(manageBaseRe);
    if (
      prev &&
      prevManage &&
      nextManage &&
      prevManage[1] === nextManage[1] &&
      prev.pathname !== location.pathname
    ) {
      return;
    }

    const legacyContestTabRe =
      /^\/hackathons\/([^/]+)\/(?:overview|timeline|prizes|partners|rules|faqs|projects)$/;
    const prevLegacy = prev?.pathname.match(legacyContestTabRe);
    const nextCanonical = location.pathname.match(/^\/hackathons\/([^/]+)$/);
    if (
      prevLegacy &&
      nextCanonical &&
      prevLegacy[1] === nextCanonical[1]
    ) {
      return;
    }

    const canonicalContest = /^\/hackathons\/([^/]+)$/;
    if (canonicalContest.test(location.pathname) && location.hash) {
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, location.search, location.hash]);

  return null;
}

export default function App() {
  const { i18n } = useTranslation();
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const startLoading = useLoadingStore((s) => s.startLoading);
  const stopLoading = useLoadingStore((s) => s.stopLoading);

  useEffect(() => {
    document.documentElement.lang =
      i18n.resolvedLanguage ?? i18n.language ?? "vi";
  }, [i18n.resolvedLanguage, i18n.language]);

  useEffect(() => {
    if (profileLoading) {
      startLoading("profile-loading");
    } else {
      stopLoading("profile-loading");
    }
  }, [profileLoading, startLoading, stopLoading]);

  if (import.meta.env.VITE_MAINTENANCE_MODE === "true") {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <MaintenancePage />
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LoadingBar />
      <Toaster />
      <AuthSync />
      <TooltipProvider>
        <BrowserRouter>
          <CredentialRealtimeSync />
          <ScrollToTop />
          <RecoveryGuard />
          <PendingCredentialsWelcomeModal />
          <Routes>
            <Route
              path="/login"
              element={
                <Suspense fallback={<PageFallback />}>
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
                <Suspense fallback={<PageFallback />}>
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
            <Route
              path="learn"
              element={
                <RequireAuth>
                  <Suspense fallback={<PageFallback />}>
                    <LearnLayout />
                  </Suspense>
                </RequireAuth>
              }
            >
              <Route
                path=":courseId"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Learn />
                  </Suspense>
                }
              />
              <Route
                path=":courseId/lesson/:lessonId"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Learn />
                  </Suspense>
                }
              />
            </Route>
            <Route
              path="/"
              element={
                <Suspense fallback={<PageFallback />}>
                  <MainLayout />
                </Suspense>
              }
            >
              <Route
                index
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Home />
                  </Suspense>
                }
              />
              <Route
                path="feed"
                element={
                  <RequireAuth>
                    <Suspense fallback={<PageFallback />}>
                      <FeedPage />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="courses"
                element={
                  <Suspense fallback={<PageFallback />}>
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
              <Route
                path="career"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CareerList />
                  </Suspense>
                }
              />
              <Route
                path="career/:slug"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CareerDetail />
                  </Suspense>
                }
              />
              <Route
                path="courses/:id"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CourseDetail />
                  </Suspense>
                }
              />
              <Route path="cohorts/:id" element={<Navigate to="/courses" replace />} />
              <Route
                path="instructors/:id"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <InstructorDetail />
                  </Suspense>
                }
              />
              <Route
                path="achievements"
                element={
                  <RequireAuth>
                    <Suspense fallback={<PageFallback />}>
                      <AchievementsPage />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="roadmap"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <RoadmapPage />
                  </Suspense>
                }
              />
              <Route path="hackathons/*" element={<Navigate to="/" replace />} />
              <Route path="projects/*" element={<Navigate to="/" replace />} />
              <Route
                path="search"
                element={
                  <Suspense fallback={<PageFallback />}>
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
                    <Suspense fallback={<PageFallback />}>
                      <Account />
                    </Suspense>
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="profile" replace />} />
                <Route
                  path="profile"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AccountProfileRoute />
                    </Suspense>
                  }
                />
                <Route
                  path="cv"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AccountCvRoute />
                    </Suspense>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AccountSettingsRoute />
                    </Suspense>
                  }
                />
                <Route path="projects" element={<Navigate to="/account" replace />} />
                <Route
                  path="instructor"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AccountInstructorProfileRoute />
                    </Suspense>
                  }
                />
              </Route>
              <Route
                path="admin"
                element={
                  <RequireRole roles={ROLE_GROUPS.admin}>
                    <Suspense fallback={<PageFallback />}>
                      <AdminLayout />
                    </Suspense>
                  </RequireRole>
                }
              >
                <Route
                  index
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AdminUsers />
                    </Suspense>
                  }
                />
                <Route
                  path="dashboard"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AdminDashboard />
                    </Suspense>
                  }
                />
                <Route
                  path="instructors"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AdminInstructors />
                    </Suspense>
                  }
                />
                <Route
                  path="instructors/:id"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AdminInstructorDetail />
                    </Suspense>
                  }
                />
                <Route
                  path="activity-milestones"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AdminActivityMilestones />
                    </Suspense>
                  }
                />
                <Route
                  path="manual-mint"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AdminManualMint />
                    </Suspense>
                  }
                />
                <Route
                  path="branding"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AdminBranding />
                    </Suspense>
                  }
                />
                <Route
                  path="hackathons/*"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <NotFound />
                    </Suspense>
                  }
                />
              </Route>
              <Route
                path="instructor"
                element={
                  <RequireRole roles={ROLE_GROUPS.instructorWorkspace}>
                    <Suspense fallback={<PageFallback />}>
                      <InstructorLayout />
                    </Suspense>
                  </RequireRole>
                }
              >
                <Route
                  path="courses"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <InstructorCourses />
                    </Suspense>
                  }
                />
                <Route
                  path="career-tracks"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <InstructorCareerTracks />
                    </Suspense>
                  }
                />
                <Route
                  path="career-tracks/new"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <InstructorCareerTrackEditor />
                    </Suspense>
                  }
                />
                <Route
                  path="career-tracks/:id/edit"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <InstructorCareerTrackEditor />
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
                    <Suspense fallback={<PageFallback />}>
                      <InstructorCourseNew />
                    </Suspense>
                  }
                />
                <Route
                  path="courses/:id/edit"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <InstructorCourseEdit />
                    </Suspense>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <InstructorWorkspaceProfileRoute />
                    </Suspense>
                  }
                />
                <Route
                  path="instructors"
                  element={
                    <RequireRole roles={ROLE_GROUPS.admin}>
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
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
