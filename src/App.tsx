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
import MainLayout from "@/components/layouts/MainLayout";
import { ThemeProvider } from "next-themes";
import { AuthSync } from "@/components/auth/AuthSync";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import { RequireContestManager } from "@/components/auth/RequireContestManager";
import Home from "@/pages/home/index";
import Courses from "@/pages/courses";
import Auth from "@/pages/login/Auth";
import OCIDRedirect from "@/pages/OCIDRedirect";
import NotFound from "@/pages/NotFound";
import { ROLE_GROUPS } from "@/config/roles";
import { useTranslation } from "react-i18next";

// Lazy-load all routes not needed on the initial render
const CourseDetail = lazy(() => import("@/pages/course-details"));
const CheckoutCourse = lazy(() => import("@/pages/CheckoutCourse"));
const CheckoutSuccess = lazy(() => import("@/pages/CheckoutSuccess"));
const Learn = lazy(() => import("@/pages/learn"));
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

const PageFallback = () => <AuthGateLoading />;

function ScrollToTop() {
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    const manageBaseRe = /^\/hackathons\/([^/]+)\/manage(?:\/|$)/;
    const prevMatch = prev?.match(manageBaseRe);
    const nextMatch = location.pathname.match(manageBaseRe);
    if (
      prevMatch &&
      nextMatch &&
      prevMatch[1] === nextMatch[1] &&
      prev !== location.pathname
    ) {
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, location.search]);

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
            <Route path="/login" element={<Auth />} />
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
            <Route path="/ocid-redirect" element={<OCIDRedirect />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Home />} />
              <Route path="courses" element={<Courses />} />
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
              <Route
                path="learn/:courseId"
                element={
                  <RequireAuth>
                    <Suspense fallback={<PageFallback />}>
                      <Learn />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="learn/:courseId/lesson/:lessonId"
                element={
                  <RequireAuth>
                    <Suspense fallback={<PageFallback />}>
                      <Learn />
                    </Suspense>
                  </RequireAuth>
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
                <Route index element={<Navigate to="overview" replace />} />
                <Route
                  path="overview"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ContestPublicPage section="overview" />
                    </Suspense>
                  }
                />
                <Route
                  path="timeline"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ContestPublicPage section="timeline" />
                    </Suspense>
                  }
                />
                <Route
                  path="prizes"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ContestPublicPage section="prizes" />
                    </Suspense>
                  }
                />
                <Route
                  path="rules"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ContestPublicPage section="rules" />
                    </Suspense>
                  }
                />
                <Route
                  path="faqs"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ContestPublicPage section="faqs" />
                    </Suspense>
                  }
                />
                <Route
                  path="projects"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ContestPublicPage section="projects" />
                    </Suspense>
                  }
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
                  path="hackathons/*"
                  element={<NotFound />}
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
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
