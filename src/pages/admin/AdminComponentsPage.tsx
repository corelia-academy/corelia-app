import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "next-themes";
import { Link, useLocation, useNavigate } from "react-router";

import { Action } from "@/components/ui/action";
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

type ComponentSlug = (typeof components)[number]["slug"];
type ActiveComponent = "overview" | ComponentSlug;

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

function scrollToComponent(slug: ComponentSlug) {
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
  const routeSlug = components.find(({ slug }) => slug === pathnameSlug)?.slug ?? null;
  const [activeComponent, setActiveComponent] = useState<ActiveComponent>(
    routeSlug ?? "overview",
  );
  const programmaticScrollRef = useRef(false);
  const scrollCleanupRef = useRef<(() => void) | null>(null);

  const beginProgrammaticScroll = useCallback((slug: ComponentSlug) => {
    scrollCleanupRef.current?.();
    programmaticScrollRef.current = true;
    setActiveComponent(slug);

    let finished = false;

    const finishScroll = () => {
      if (finished) return;

      finished = true;
      window.removeEventListener("scrollend", finishScroll);

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      scrollCleanupRef.current = null;
      programmaticScrollRef.current = false;
      setActiveComponent(slug);
    };

    const timeoutId = window.setTimeout(finishScroll, 2000);
    window.addEventListener("scrollend", finishScroll, { once: true });
    scrollCleanupRef.current = () => {
      if (finished) return;

      finished = true;
      window.removeEventListener("scrollend", finishScroll);

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      scrollCleanupRef.current = null;
      programmaticScrollRef.current = false;
    };

    scrollToComponent(slug);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setActiveComponent(routeSlug ?? "overview");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [routeSlug]);

  useEffect(() => {
    if (!routeSlug) return;

    const timeoutId = window.setTimeout(
      () => beginProgrammaticScroll(routeSlug),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [beginProgrammaticScroll, routeSlug]);

  useEffect(() => {
    return () => scrollCleanupRef.current?.();
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      () => {
        if (programmaticScrollRef.current) return;

        const activationY = 96;
        let nextActiveComponent: ActiveComponent = "overview";

        for (const { slug } of components) {
          const section = document.getElementById(`component-${slug}`);

          if (section && section.getBoundingClientRect().top <= activationY) {
            nextActiveComponent = slug;
          }
        }

        setActiveComponent(nextActiveComponent);
      },
      {
        root: null,
        rootMargin: "-40px 0px -60% 0px",
        threshold: [0, 1],
      },
    );

    for (const component of components) {
      const section = document.getElementById(`component-${component.slug}`);
      if (section) observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <main className="container-app min-h-screen select-none space-y-8 py-6 sm:py-8">
      <header className="space-y-4">
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
        <aside className="min-w-0 lg:sticky lg:top-6 lg:flex lg:h-[calc(100dvh-3rem)] lg:flex-col lg:self-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit justify-start"
            onClick={() => navigate("/")}
          >
            <ArrowLeft aria-hidden />
            Back to app
          </Button>

          <div className="mt-4 rounded-lg border border-border-subtle bg-surface-base p-3">
            <p className="px-3 pb-2 text-label-medium uppercase tracking-[0.08em] text-foreground-muted">
              Components
            </p>
            <nav
              aria-label="Component navigation"
              className="flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible"
              data-testid="component-navigation"
            >
              {components.map(({ slug, title }) => (
                <Action
                  key={slug}
                  nativeButton={false}
                  render={
                    <Link
                      to={`/components/${slug}`}
                      aria-current={
                        activeComponent === slug ? "page" : undefined
                      }
                    />
                  }
                  label={title}
                  size="small"
                  isActive={activeComponent === slug}
                  className="justify-start"
                  onClick={() => {
                    setActiveComponent(slug);
                    if (routeSlug === slug) {
                      beginProgrammaticScroll(slug);
                    }
                  }}
                />
              ))}
            </nav>
          </div>

          <div className="mt-auto flex shrink-0 gap-2 pt-6">
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
