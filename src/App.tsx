import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router";
import MainLayout from "@/components/layouts/MainLayout";
import { ThemeProvider } from "next-themes";
import { AuthSync } from "@/components/auth/AuthSync";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import Home from "@/pages/Home";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import CheckoutCourse from "@/pages/CheckoutCourse";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import Learn from "@/pages/Learn";
import InstructorDetail from "@/pages/InstructorDetail";
import Account, {
  AccountProfileRoute,
  AccountCvRoute,
  AccountBillingRoute,
  AccountInstructorProfileRoute,
  AccountSettingsRoute,
  InstructorWorkspaceProfileRoute,
} from "@/pages/Account";
import Auth from "@/pages/login/Auth";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminInstructors from "@/pages/admin/AdminInstructors";
import AdminInstructorDetail from "@/pages/admin/AdminInstructorDetail";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Achievements from "@/pages/Achievements";
import InstructorLayout from "@/pages/instructor/InstructorLayout";
import InstructorCourses from "@/pages/InstructorCourses";
import InstructorContests from "@/pages/InstructorContests";
import InstructorCourseNew from "@/pages/InstructorCourseNew";
import InstructorCourseEdit from "@/pages/InstructorCourseEdit";
import Contests from "@/pages/Contests";
import ContestNew from "@/pages/ContestNew";
import ContestDetail from "@/pages/ContestDetail";
import Cohorts from "@/pages/Cohorts";
import CohortDetail from "@/pages/CohortDetail";
import InstructorCohorts from "@/pages/InstructorCohorts";
import CohortNew from "@/pages/CohortNew";
import { RequireOfflineAcademyManager } from "@/components/auth/RequireOfflineAcademyManager";
import { RequireContestManager } from "@/components/auth/RequireContestManager";
import {
  PartnerContractsPage,
  PartnerInvoicesPage,
  PartnerPaymentsPage,
} from "@/pages/instructor/PartnerFinance";
import OCIDRedirect from "@/pages/OCIDRedirect";
import { useTranslation } from "react-i18next";

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, location.search]);

  return null;
}

function LegacyContestManageRedirect() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  if (!id) return <Navigate to="/instructor/contests" replace />;
  return (
    <Navigate
      to={`/instructor/contests/${id}/manage${location.search}`}
      replace
    />
  );
}

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language ?? "vi";
  }, [i18n.resolvedLanguage, i18n.language]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Toaster />
      <AuthSync />
      <TooltipProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Auth />} />
            <Route path="/ocid-redirect" element={<OCIDRedirect />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Home />} />
              <Route path="courses" element={<Courses />} />
              <Route path="cohorts" element={<Cohorts />} />
              <Route path="courses/:id" element={<CourseDetail />} />
              <Route path="cohorts/:id" element={<CohortDetail />} />
              <Route
                path="checkout/course/:courseId"
                element={
                  <RequireAuth>
                    <CheckoutCourse />
                  </RequireAuth>
                }
              />
              <Route
                path="checkout/success/:purpose/:courseId"
                element={
                  <RequireAuth>
                    <CheckoutSuccess />
                  </RequireAuth>
                }
              />
              <Route path="instructors/:id" element={<InstructorDetail />} />
              <Route
                path="learn/:courseId"
                element={
                  <RequireAuth>
                    <Learn />
                  </RequireAuth>
                }
              />
              <Route
                path="learn/:courseId/lesson/:lessonId"
                element={
                  <RequireAuth>
                    <Learn />
                  </RequireAuth>
                }
              />
              <Route
                path="achievements"
                element={
                  <RequireAuth>
                    <Achievements />
                  </RequireAuth>
                }
              />
              <Route path="contests" element={<Contests />} />
              <Route path="contests/:id" element={<ContestDetail />} />
              <Route
                path="contests/:id/manage"
                element={<LegacyContestManageRedirect />}
              />
              <Route
                path="contests/new"
                element={<Navigate to="/instructor/contests/new" replace />}
              />
              <Route
                path="account"
                element={
                  <RequireAuth>
                    <Account />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="settings" replace />} />
                <Route path="profile" element={<AccountProfileRoute />} />
                <Route path="cv" element={<AccountCvRoute />} />
                <Route path="billing" element={<AccountBillingRoute />} />
                <Route path="settings" element={<AccountSettingsRoute />} />
                <Route
                  path="instructor"
                  element={<AccountInstructorProfileRoute />}
                />
              </Route>
              <Route
                path="admin"
                element={
                  <RequireRole roles={["admin", "support_staff"]}>
                    <AdminLayout />
                  </RequireRole>
                }
              >
                <Route index element={<AdminUsers />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="instructors" element={<AdminInstructors />} />
                <Route
                  path="instructors/:id"
                  element={<AdminInstructorDetail />}
                />
              </Route>
              <Route
                path="instructor"
                element={
                  <RequireRole roles={["instructor", "support_staff", "admin"]}>
                    <InstructorLayout />
                  </RequireRole>
                }
              >
                <Route path="courses" element={<InstructorCourses />} />
                <Route
                  path="cohorts"
                  element={
                    <RequireOfflineAcademyManager>
                      <InstructorCohorts />
                    </RequireOfflineAcademyManager>
                  }
                />
                <Route
                  path="cohorts/new"
                  element={
                    <RequireOfflineAcademyManager>
                      <CohortNew />
                    </RequireOfflineAcademyManager>
                  }
                />
                <Route
                  path="cohorts/:id/manage"
                  element={
                    <RequireOfflineAcademyManager>
                      <CohortDetail />
                    </RequireOfflineAcademyManager>
                  }
                />
                <Route path="courses/new" element={<InstructorCourseNew />} />
                <Route
                  path="courses/:id/edit"
                  element={<InstructorCourseEdit />}
                />
                <Route
                  path="contests"
                  element={
                    <RequireContestManager>
                      <InstructorContests />
                    </RequireContestManager>
                  }
                />
                <Route
                  path="contests/new"
                  element={
                    <RequireContestManager>
                      <ContestNew />
                    </RequireContestManager>
                  }
                />
                <Route
                  path="contests/:id/manage"
                  element={
                    <RequireContestManager>
                      <ContestDetail />
                    </RequireContestManager>
                  }
                />
                <Route
                  path="profile"
                  element={<InstructorWorkspaceProfileRoute />}
                />
                <Route path="contracts" element={<PartnerContractsPage />} />
                <Route path="invoices" element={<PartnerInvoicesPage />} />
                <Route path="payments" element={<PartnerPaymentsPage />} />
                <Route
                  path="instructors"
                  element={
                    <RequireRole roles={["support_staff", "admin"]}>
                      <Navigate to="/admin/instructors" replace />
                    </RequireRole>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}
