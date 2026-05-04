import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import MainLayout from "@/components/layouts/MainLayout";
import { ThemeProvider } from "next-themes";
import { AuthSync } from "@/components/auth/AuthSync";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import Home from "@/pages/home/index";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/course-details";
import CheckoutCourse from "@/pages/CheckoutCourse";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import Learn from "@/pages/learn";
import InstructorDetail from "@/pages/InstructorDetail";
import Account, {
  AccountProfileRoute,
  AccountCvRoute,
  AccountBillingRoute,
  AccountInstructorProfileRoute,
  AccountSettingsRoute,
  InstructorWorkspaceProfileRoute,
} from "@/pages/account/Account";
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
import RoadmapPage from "@/pages/roadmap";
import Contests from "@/pages/Contests";
import ContestNew from "@/pages/ContestNew";
import ContestPublicLayout from "@/pages/contest-detail/ContestPublicLayout";
import ContestPublicPage from "@/pages/contest-detail/ContestPublicPage";
import ContestApplyRedirect from "@/pages/contest-detail/ContestApplyRedirect";
import ContestWorkspace from "@/pages/admin/ContestWorkspace";
import { ROLE_GROUPS } from "@/config/roles";
import {
  PartnerContractsPage,
  PartnerInvoicesPage,
  PartnerPaymentsPage,
} from "@/pages/instructor/PartnerFinance";
import OCIDRedirect from "@/pages/OCIDRedirect";
import NotFound from "@/pages/NotFound";
import { useTranslation } from "react-i18next";

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
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
              <Route path="cohorts" element={<Navigate to="/courses" replace />} />
              <Route path="courses/:id" element={<CourseDetail />} />
              <Route path="cohorts/:id" element={<Navigate to="/courses" replace />} />
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
              <Route path="roadmap" element={<RoadmapPage />} />
              <Route path="contests" element={<Contests />} />
              <Route path="contests/:id" element={<ContestPublicLayout />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<ContestPublicPage section="overview" />} />
                <Route path="timeline" element={<ContestPublicPage section="timeline" />} />
                <Route path="prizes" element={<ContestPublicPage section="prizes" />} />
                <Route path="rules" element={<ContestPublicPage section="rules" />} />
                <Route path="faqs" element={<ContestPublicPage section="faqs" />} />
                <Route path="projects" element={<ContestPublicPage section="projects" />} />
                <Route path="apply" element={<ContestApplyRedirect />} />
              </Route>
              <Route
                path="account"
                element={
                  <RequireAuth>
                    <Account />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="profile" replace />} />
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
                  <RequireRole roles={ROLE_GROUPS.admin}>
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
                <Route path="contests" element={<InstructorContests />} />
                <Route path="contests/new" element={<ContestNew />} />
                <Route path="contests/:id/manage" element={<ContestWorkspace />} />
              </Route>
              <Route
                path="instructor"
                element={
                  <RequireRole roles={ROLE_GROUPS.instructorWorkspace}>
                    <InstructorLayout />
                  </RequireRole>
                }
              >
                <Route path="courses" element={<InstructorCourses />} />
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
                <Route path="courses/new" element={<InstructorCourseNew />} />
                <Route
                  path="courses/:id/edit"
                  element={<InstructorCourseEdit />}
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
                    <RequireRole roles={ROLE_GROUPS.admin}>
                      <Navigate to="/admin/instructors" replace />
                    </RequireRole>
                  }
                />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}
