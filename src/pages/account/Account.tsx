import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  CreditCard,
  GraduationCap,
  IdCard,
  Settings,
  UserCircle,
} from "lucide-react";
export { AccountBillingRoute } from "./AccountBillingRoute";
export { AccountCvRoute } from "./AccountCvRoute";
export {
  AccountInstructorProfileRoute,
  InstructorWorkspaceProfileRoute,
} from "./AccountInstructorRoutes";
export { AccountProfileRoute } from "./AccountProfileRoute";
export { AccountSettingsRoute } from "./AccountSettingsRoute";

export default function Account() {
  const { profile } = useAuth();
  const location = useLocation();
  const { t } = useTranslation("account");
  const navItems = [
    {
      to: "/account/profile",
      end: false,
      title: t("nav.profile.title"),
      description: t("nav.profile.description"),
      icon: <UserCircle className="size-4 shrink-0" aria-hidden />,
    },
    ...(profile?.role === "instructor"
      ? [
          {
            to: "/account/instructor",
            title: t("nav.instructor.title"),
            description: t("nav.instructor.description"),
            icon: <GraduationCap className="size-4 shrink-0" aria-hidden />,
          },
        ]
      : []),
    {
      to: "/account/cv",
      title: t("nav.cv.title"),
      description: t("nav.cv.description"),
      icon: <IdCard className="size-4 shrink-0" aria-hidden />,
    },
    {
      to: "/account/billing",
      title: t("nav.billing.title"),
      description: t("nav.billing.description"),
      icon: <CreditCard className="size-4 shrink-0" aria-hidden />,
    },
    {
      to: "/account/settings",
      title: t("nav.settings.title"),
      description: t("nav.settings.description"),
      icon: <Settings className="size-4 shrink-0" aria-hidden />,
    },
  ];

  const activeNavItem =
    navItems.find((item) => location.pathname.startsWith(item.to)) ??
    navItems[0];

  // Layout cho khu vực account, nội dung từng tab được render qua nested routes (Outlet)
  return (
    <div className="container-app py-6 sm:py-8">
      <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-72 lg:shrink-0">
          <div className="mb-4 hidden text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:block">
            {t("nav.sectionTitle")}
          </div>
          <div className="-mx-4 overflow-x-auto px-4 lg:hidden">
            <div className="flex min-w-max gap-2 pb-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : undefined}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                      isActive
                        ? "border-primary/25 bg-primary-container text-on-primary-container shadow-card"
                        : "border-border-subtle bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )
                  }
                >
                  <span className="shrink-0 text-primary">{item.icon}</span>
                  <span className="whitespace-nowrap">{item.title}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="hidden rounded-md border border-border-subtle bg-card p-2 shadow-card lg:block">
            <div className="grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : undefined}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-3 text-left transition-colors duration-150",
                      isActive
                        ? "bg-primary-container text-on-primary-container shadow-card"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 text-primary">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                  </div>
                </NavLink>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-4">
          <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card lg:hidden">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 text-primary">
                {activeNavItem.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("nav.currentSectionLabel")}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">
                  {activeNavItem.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeNavItem.description}
                </p>
              </div>
            </div>
          </section>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
