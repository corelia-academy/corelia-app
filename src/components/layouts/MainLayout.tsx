import type { CSSProperties } from "react";
import { useAuth } from "@/stores/authStore";
import { isPublicPresentation } from "./publicPresentation";
import "@/styles/public-ui.css";
import { Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { GsapAnimationController } from "@/components/animations/GsapAnimationController";
import Header from "./Header";

/** Header shared with the landing site, then the page. Navigation lives in the header only. */
const MainLayout = () => {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const publicUI = isPublicPresentation(pathname, isAuthenticated);
  return (
    <div
      className="public-ui flex min-h-svh w-full flex-col lg:h-svh"
      style={{ "--app-header-height": "72px" } as CSSProperties}
    >
      <GsapAnimationController />
      <Header />
      <main
        className="relative flex min-h-[calc(100svh-var(--app-header-height))] min-w-0 flex-1 flex-col bg-surface-base lg:overflow-y-auto"
        style={{ "--main-shell-header-height": "var(--app-header-height)" } as CSSProperties}
      >
        <div className={publicUI ? "public-content flex-1" : "flex-1"}>
          <Outlet />
        </div>
        <AppFooter />
      </main>
    </div>
  );
};

export default MainLayout;

/** Product links that used to sit at the bottom of the sidebar. */
const FOOTER_LINKS = [
  { labelKey: "nav.changelog", href: "/blog" },
  { labelKey: "nav.productRoadmap", href: "https://github.com/corelia-academy/corelia-app/releases" },
  { labelKey: "nav.feedback", href: "/contact" },
] as const;

function AppFooter() {
  const { t } = useTranslation("common");
  return (
    <footer className="border-t border-border px-4 py-4 text-sm text-foreground-muted sm:px-6">
      <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {FOOTER_LINKS.map(({ labelKey, href }) => {
          const external = href.startsWith("http");
          return (
            <a
              key={labelKey}
              href={href}
              className="transition-colors hover:text-foreground"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {t(labelKey)}
            </a>
          );
        })}
      </nav>
    </footer>
  );
}
