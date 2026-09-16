import { useEffect, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "next-themes";
import { NavLink, useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

import AdminActionComponentPage from "./components/AdminActionComponentPage";
import AdminBadgeComponentPage from "./components/AdminBadgeComponentPage";
import AdminScrollbarComponentPage from "./components/AdminScrollbarComponentPage";
import AdminSelectionComponentPage from "./components/AdminSelectionComponentPage";
import AdminSeparatorComponentPage from "./components/AdminSeparatorComponentPage";
import AdminTagComponentPage from "./components/AdminTagComponentPage";
import AdminToggleComponentPage from "./components/AdminToggleComponentPage";

const components = [
  {
    slug: "action",
    title: "Action",
    criterion: "Variants, active state, pressed state, content slots, and disabled behavior.",
  },
  {
    slug: "badge",
    title: "Badge",
    criterion: "Color, outline/filled variant, size, and icon combinations.",
  },
  {
    slug: "tag",
    title: "Tag / Chips",
    criterion: "Label, leading visual, date-time, size, and disabled combinations.",
  },
  {
    slug: "selection",
    title: "Selection",
    criterion: "Checkbox, radio, cards, checked, indeterminate, focus, and disabled states.",
  },
  {
    slug: "toggle",
    title: "Toggle",
    criterion: "Toggle variants, sizes, checked state, disabled state, and IconToggle.",
  },
  {
    slug: "separator",
    title: "Separator",
    criterion: "Horizontal/vertical orientation with solid and dashed variants.",
  },
  {
    slug: "scrollbar",
    title: "Scrollbar",
    criterion: "Real vertical and horizontal overflow in three content-density examples.",
  },
] as const;

type ComponentSectionProps = {
  slug: string;
  title: string;
  criterion: string;
  children: ReactNode;
};

function ComponentSection({
  slug,
  title,
  criterion,
  children,
}: ComponentSectionProps) {
  return (
    <section
      id={`component-${slug}`}
      aria-labelledby={`component-${slug}-title`}
      className="scroll-mt-6"
    >
      <header className="space-y-2">
        <h2
          id={`component-${slug}-title`}
          className="text-heading-large font-display"
          data-testid="component-section-title"
        >
          {title}
        </h2>
        <p className="text-body-medium text-foreground-muted">{criterion}</p>
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function scrollToComponent(slug: string) {
  document.getElementById(`component-${slug}`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export default function AdminComponentsPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const pathnameSlug = pathname.split("/").at(-1);
  const activeSlug = components.some(({ slug }) => slug === pathnameSlug)
    ? pathnameSlug
    : null;

  useEffect(() => {
    if (!activeSlug) return;

    const timeoutId = window.setTimeout(() => scrollToComponent(activeSlug), 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeSlug]);

  return (
    <main className="container-app min-h-screen select-none space-y-8 py-6 sm:py-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
          >
            <ArrowLeft aria-hidden />
            Back to app
          </Button>
          <div className="flex items-center gap-2">
            <p className="text-label-medium uppercase tracking-[0.08em] text-foreground-muted">
              Admin component lab
            </p>
            {(["light", "dark"] as const).map((theme) => (
              <Button
                key={theme}
                type="button"
                size="sm"
                variant="outline"
                data-testid={`theme-toggle-${theme}`}
                aria-pressed={resolvedTheme === theme}
                onClick={() => setTheme(theme)}
              >
                {theme === "light" ? "Light" : "Dark"}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-label-medium uppercase tracking-[0.08em] text-primary">
            Design system review
          </p>
          <h1 className="mt-2 text-heading-large font-display">All Components</h1>
          <p className="mt-2 max-w-3xl text-body-medium text-foreground-muted">
            Browse every component in one page. Use the menu to jump to a section and test its interactive states.
          </p>
        </div>
      </header>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-border-subtle bg-surface-base p-3">
            <p className="px-3 pb-2 text-label-medium uppercase tracking-[0.08em] text-foreground-muted">
              Components
            </p>
            <nav
              aria-label="Component navigation"
              className="flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible"
              data-testid="component-navigation"
            >
              <NavLink
                end
                to="/components"
                className={({ isActive }) =>
                  `block min-h-9 whitespace-nowrap rounded-md px-3 py-2 text-body-small transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                    isActive
                      ? "bg-primary-muted text-primary"
                      : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                  }`
                }
              >
                Overview
              </NavLink>
              {components.map(({ slug, title }) => (
                <NavLink
                  key={slug}
                  to={`/components/${slug}`}
                  onClick={() => {
                    if (activeSlug === slug) scrollToComponent(slug);
                  }}
                  className={({ isActive }) =>
                    `block min-h-9 whitespace-nowrap rounded-md px-3 py-2 text-body-small transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                      isActive
                        ? "bg-primary-muted text-primary"
                        : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                    }`
                  }
                >
                  {title}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-10" data-testid="component-sections">
          <ComponentSection {...components[0]}>
            <AdminActionComponentPage embedded />
          </ComponentSection>
          <ComponentSection {...components[1]}>
            <AdminBadgeComponentPage embedded />
          </ComponentSection>
          <ComponentSection {...components[2]}>
            <AdminTagComponentPage embedded />
          </ComponentSection>
          <ComponentSection {...components[3]}>
            <AdminSelectionComponentPage embedded />
          </ComponentSection>
          <ComponentSection {...components[4]}>
            <AdminToggleComponentPage embedded />
          </ComponentSection>
          <ComponentSection {...components[5]}>
            <AdminSeparatorComponentPage embedded />
          </ComponentSection>
          <ComponentSection {...components[6]}>
            <AdminScrollbarComponentPage embedded />
          </ComponentSection>
        </div>
      </div>
    </main>
  );
}
