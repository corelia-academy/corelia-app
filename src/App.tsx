import { Suspense, lazy, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthGateLoading } from "@/components/auth/AuthGateLoading";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { ThemeProvider } from "next-themes";
import { AuthSync } from "@/components/auth/AuthSync";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import { RequireContestManager } from "@/components/auth/RequireContestManager";
import { ROLE_GROUPS } from "@/config/roles";
import { useTranslation } from "react-i18next";

// Lazy-load all routes not needed on the initial render
const Home = lazy(() => import("@/pages/home/index"));
const Courses = lazy(() => import("@/pages/courses"));
const Auth = lazy(() => import("@/pages/login/Auth"));
const OCIDRedirect = lazy(() => import("@/pages/OCIDRedirect"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const MainLayout = lazy(() => import("@/components/layouts/MainLayout"));
const CourseDetail = lazy(() => import("@/pages/course-details"));
const CheckoutCourse = lazy(() => import("@/pages/CheckoutCourse"));
const CheckoutSuccess = lazy(() => import("@/pages/CheckoutSuccess"));
const Learn = lazy(() => import("@/pages/learn"));
const LearnLayout = lazy(() => import("@/pages/learn/LearnLayout"));
const InstructorDetail = lazy(() => import("@/pages/InstructorDetail"));
const RoadmapPage = lazy(() => import("@/pages/roadmap"));
const CareerList = lazy(() => import("@/pages/career"));
const CareerDetail = lazy(() => import("@/pages/career/CareerDetailPage"));
const Contests = lazy(() => import("@/pages/hackathon-detail/Contests"));
const ContestNew = lazy(() => import("@/pages/hackathon-detail/ContestNew"));
const ContestPublicLayout = lazy(() => import("@/pages/hackathon-detail/ContestPublicLayout"));
const ContestPublicPage = lazy(() => import("@/pages/hackathon-detail/ContestPublicPage"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectInvitePage = lazy(() => import("@/pages/invites/ProjectInvitePage"));
const SearchPage = lazy(() => import("@/pages/search"));
import { ContestManageIndexRedirect } from "@/pages/hackathon-detail/ContestManageIndexRedirect";
import { ContestPublicLegacyRedirect } from "@/pages/hackathon-detail/ContestPublicLegacyRedirect";

const ContestWorkspacePublicRoute = lazy(() =>
  import("@/pages/hackathon-detail/ContestDetail").then((m) => ({
    default: m.ContestDetailManagePage,
  })),
);
const ConfirmSignup = lazy(() => import("@/pages/auth/ConfirmSignup"));
const SignupVerified = lazy(() => import("@/pages/auth/SignupVerified"));
const UserProfileLayout = lazy(() => import("@/pages/users/user-profile"));
const UserHandleRedirect = lazy(() => import("@/pages/users/UserHandleRedirect"));

const Account = lazy(() => import("@/pages/account/Account"));
const AccountProfileRoute = lazy(() =>
  import("@/pages/account/AccountProfileRoute").then((m) => ({ default: m.AccountProfileRoute })),
);
const AccountCvRoute = lazy(() =>
  import("@/pages/account/AccountCvRoute").then((m) => ({ default: m.AccountCvRoute })),
);
const CoraCheckoutPage = lazy(() => import("@/pages/cora/CoraCheckoutPage"));
const AccountBillingRoute = lazy(() =>
  import("@/pages/account/AccountBillingRoute").then((m) => ({ default: m.AccountBillingRoute })),
);
const AccountSettingsRoute = lazy(() =>
  import("@/pages/account/AccountSettingsRoute").then((m) => ({ default: m.AccountSettingsRoute })),
);
const AccountProjectsRoute = lazy(() =>
  import("@/pages/account/AccountProjectsRoute").then((m) => ({ default: m.AccountProjectsRoute })),
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
const InstructorContests = lazy(() => import("@/pages/hackathon-detail/InstructorContests"));
const InstructorCourseNew = lazy(() => import("@/pages/instructor-course-new"));
const InstructorCourseEdit = lazy(() => import("@/pages/instructor-course-edit"));
const InstructorCareerTracks = lazy(() => import("@/pages/instructor-career-tracks"));
const InstructorCareerTrackEditor = lazy(
  () => import("@/pages/instructor-career-tracks/InstructorCareerTrackEditorPage"),
);
const PartnerContractsPage = lazy(() =>
  import("@/pages/instructor/PartnerFinance").then((m) => ({ default: m.PartnerContractsPage })),
);
const PartnerInvoicesPage = lazy(() =>
  import("@/pages/instructor/PartnerFinance").then((m) => ({ default: m.PartnerInvoicesPage })),
);
const PartnerPaymentsPage = lazy(() =>
  import("@/pages/instructor/PartnerFinance").then((m) => ({ default: m.PartnerPaymentsPage })),
);

const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminInstructors = lazy(() => import("@/pages/admin/AdminInstructors"));
const AdminInstructorDetail = lazy(() => import("@/pages/admin/AdminInstructorDetail"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminActivityMilestones = lazy(() => import("@/pages/admin/AdminActivityMilestones"));

const PageFallback = () => <AuthGateLoading />;

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

  useEffect(() => {
    document.documentElement.lang =
      i18n.resolvedLanguage ?? i18n.language ?? "vi";
  }, [i18n.resolvedLanguage, i18n.language]);

  return (
    <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Toaster />
      <AuthSync />
      <TooltipProvider>
        <BrowserRouter>
          <ScrollToTop />
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
              path="/ocid-redirect"
              element={
                <Suspense fallback={<PageFallback />}>
                  <OCIDRedirect />
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
                path="career/corelia/:slug"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CareerDetail />
                  </Suspense>
                }
              />
              <Route
                path="career/:handle/:slug"
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
                path="checkout/course/:courseId"
                element={
                  <RequireAuth>
                    <Suspense fallback={<PageFallback />}>
                      <CheckoutCourse />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="checkout/success/:purpose/:courseId"
                element={
                  <RequireAuth>
                    <Suspense fallback={<PageFallback />}>
                      <CheckoutSuccess />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="instructors/:id"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <InstructorDetail />
                  </Suspense>
                }
              />
              <Route path="achievements" element={<Navigate to="/account" replace />} />
              <Route
                path="roadmap"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <RoadmapPage />
                  </Suspense>
                }
              />
              <Route
                path="hackathons"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Contests />
                  </Suspense>
                }
              />
              <Route
                path="hackathons/manage"
                element={
                  <RequireAuth>
                    <RequireContestManager>
                      <Suspense fallback={<PageFallback />}>
                        <InstructorContests />
                      </Suspense>
                    </RequireContestManager>
                  </RequireAuth>
                }
              />
              <Route
                path="hackathons/new"
                element={
                  <RequireAuth>
                    <RequireContestManager>
                      <Suspense fallback={<PageFallback />}>
                        <ContestNew />
                      </Suspense>
                    </RequireContestManager>
                  </RequireAuth>
                }
              />
              <Route
                path="projects"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Projects />
                  </Suspense>
                }
              />
              <Route
                path="search"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <SearchPage />
                  </Suspense>
                }
              />
              <Route
                path="hackathons/:slug/manage"
                element={
                  <RequireAuth>
                    <Outlet />
                  </RequireAuth>
                }
              >
                <Route index element={<ContestManageIndexRedirect />} />
                <Route
                  path=":section"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ContestWorkspacePublicRoute />
                    </Suspense>
                  }
                />
              </Route>
              <Route
                path="hackathons/:slug"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ContestPublicLayout />
                  </Suspense>
                }
              >
                <Route
                  index
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ContestPublicPage />
                    </Suspense>
                  }
                />
                <Route
                  path="overview"
                  element={<ContestPublicLegacyRedirect tab="overview" />}
                />
                <Route
                  path="timeline"
                  element={<ContestPublicLegacyRedirect tab="timeline" />}
                />
                <Route
                  path="prizes"
                  element={<ContestPublicLegacyRedirect tab="prizes" />}
                />
                <Route
                  path="partners"
                  element={<ContestPublicLegacyRedirect tab="partners" />}
                />
                <Route
                  path="rules"
                  element={<ContestPublicLegacyRedirect tab="rules" />}
                />
                <Route
                  path="faqs"
                  element={<ContestPublicLegacyRedirect tab="faqs" />}
                />
                <Route
                  path="projects"
                  element={<ContestPublicLegacyRedirect tab="projects" />}
                />
              </Route>
              <Route
                path="u/:handle"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <UserProfileLayout />
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
                  path="billing"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AccountBillingRoute />
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
                <Route
                  path="projects"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AccountProjectsRoute />
                    </Suspense>
                  }
                />
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
                path="account/cora"
                element={<Navigate to="/cora" replace />}
              />
              <Route
                path="cora"
                element={
                  <RequireAuth>
                    <Suspense fallback={<PageFallback />}>
                      <CoraCheckoutPage />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route path="upgrade/cora" element={<Navigate to="/cora" replace />} />
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
                  path="contracts"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <PartnerContractsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="invoices"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <PartnerInvoicesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="payments"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <PartnerPaymentsPage />
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
