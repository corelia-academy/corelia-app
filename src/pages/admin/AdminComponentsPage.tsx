import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft } from "lucide-react";
import { gsap } from "gsap";
import { useTheme } from "next-themes";
import { Link, useLocation, useNavigate } from "react-router";

import { Action } from "@/components/ui/action";
import { Button } from "@/components/ui/button";

import AdminActionComponentPage from "./components/AdminActionComponentPage";
import AdminBadgeComponentPage from "./components/AdminBadgeComponentPage";
import AdminDropdownMenuComponentPage from "./components/AdminDropdownMenuComponentPage";
import AdminScrollbarComponentPage from "./components/AdminScrollbarComponentPage";
import AdminSelectionComponentPage from "./components/AdminSelectionComponentPage";
import AdminSeparatorComponentPage from "./components/AdminSeparatorComponentPage";
import AdminTagComponentPage from "./components/AdminTagComponentPage";
import AdminTabsComponentPage from "./components/AdminTabsComponentPage";
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
  {
    slug: "tabs",
    title: "Tabs",
    criterion: "Five Figma levels, horizontal/vertical orientation, active, disabled, badge, and keyboard behavior.",
  },
  {
    slug: "dropdown-menu",
    title: "Dropdown Menu",
    criterion: "Figma Base Items with five real states, two leading-icon variants, and six independent dropdown use cases with search, Select All, warning, disabled, and nested-list behavior.",
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
  const skipRouteScrollRef = useRef(false);
  const scrollCleanupRef = useRef<(() => void) | null>(null);
  const sidebarScrollTweenRef = useRef<ReturnType<typeof gsap.to> | null>(
    null,
  );
  const activeIndicatorRef = useRef<HTMLSpanElement | null>(null);
  const activeIndicatorTweenRef = useRef<ReturnType<typeof gsap.to> | null>(
    null,
  );
  const componentNavigationRef = useRef<HTMLElement | null>(null);
  const routeSlugRef = useRef<ComponentSlug | null>(routeSlug);
  const navigateRef = useRef(navigate);

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
    routeSlugRef.current = routeSlug;
    navigateRef.current = navigate;
  }, [navigate, routeSlug]);

  useLayoutEffect(() => {
    const navigation = componentNavigationRef.current;
    const activeIndicator = activeIndicatorRef.current;

    if (!navigation || !activeIndicator) return;

    const activeItem = activeComponent === "overview"
      ? null
      : navigation.querySelector<HTMLElement>(
        `[data-component-nav-item="${activeComponent}"]`,
      );

    activeIndicatorTweenRef.current?.kill();

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!activeItem) {
      if (prefersReducedMotion) {
        gsap.set(activeIndicator, { opacity: 0 });
        activeIndicatorTweenRef.current = null;
        return;
      }

      activeIndicatorTweenRef.current = gsap.to(activeIndicator, {
        opacity: 0,
        duration: 0.2,
        ease: "power2.out",
        overwrite: "auto",
        onComplete: () => {
          activeIndicatorTweenRef.current = null;
        },
      });
      return;
    }

    const target = {
      x: activeItem.offsetLeft,
      y: activeItem.offsetTop,
      width: activeItem.offsetWidth,
      height: activeItem.offsetHeight,
      opacity: 1,
    };

    if (prefersReducedMotion) {
      gsap.set(activeIndicator, target);
      activeIndicatorTweenRef.current = null;
      return;
    }

    if (activeIndicator.dataset.positioned !== "true") {
      gsap.set(activeIndicator, { ...target, opacity: 0 });
      activeIndicator.dataset.positioned = "true";
    }

    activeIndicatorTweenRef.current = gsap.to(activeIndicator, {
      ...target,
      duration: 0.32,
      ease: "power3.out",
      overwrite: "auto",
      onComplete: () => {
        activeIndicatorTweenRef.current = null;
      },
    });

    return () => {
      activeIndicatorTweenRef.current?.kill();
    };
  }, [activeComponent]);

  useEffect(() => {
    if (skipRouteScrollRef.current) {
      skipRouteScrollRef.current = false;
      return;
    }

    if (!routeSlug) return;

    const timeoutId = window.setTimeout(
      () => beginProgrammaticScroll(routeSlug),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [beginProgrammaticScroll, routeSlug]);

  useEffect(() => {
    if (activeComponent === "overview") return;

    const navigation = componentNavigationRef.current;
    const activeItem = navigation?.querySelector<HTMLElement>(
      `[data-component-nav-item="${activeComponent}"]`,
    );

    if (!navigation || !activeItem) return;

    const padding = 12;
    const navigationRect = navigation.getBoundingClientRect();
    const activeItemRect = activeItem.getBoundingClientRect();
    const visibleTop = navigationRect.top + padding;
    const visibleBottom = navigationRect.bottom - padding;
    const maxScrollTop = Math.max(
      0,
      navigation.scrollHeight - navigation.clientHeight,
    );

    const scrollToClampedPosition = (delta: number) => {
      const nextScrollTop = Math.min(
        maxScrollTop,
        Math.max(0, navigation.scrollTop + delta),
      );

      if (nextScrollTop === navigation.scrollTop) return;

      if (
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ) {
        navigation.scrollTop = nextScrollTop;
        return;
      }

      sidebarScrollTweenRef.current?.kill();
      sidebarScrollTweenRef.current = gsap.to(navigation, {
        scrollTop: nextScrollTop,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
        onComplete: () => {
          sidebarScrollTweenRef.current = null;
        },
      });
    };

    if (activeItemRect.top < visibleTop) {
      scrollToClampedPosition(activeItemRect.top - visibleTop);
      return;
    }

    if (activeItemRect.bottom > visibleBottom) {
      scrollToClampedPosition(activeItemRect.bottom - visibleBottom);
    }
  }, [activeComponent]);

  useEffect(() => {
    return () => {
      scrollCleanupRef.current?.();
      sidebarScrollTweenRef.current?.kill();
      activeIndicatorTweenRef.current?.kill();
    };
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

        const currentRouteSlug = routeSlugRef.current ?? "overview";

        if (nextActiveComponent === currentRouteSlug) return;

        skipRouteScrollRef.current = true;
        routeSlugRef.current =
          nextActiveComponent === "overview" ? null : nextActiveComponent;
        navigateRef.current(
          nextActiveComponent === "overview"
            ? "/components"
            : `/components/${nextActiveComponent}`,
          {
            replace: true,
            preventScrollReset: true,
          },
        );
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

      <div className="grid min-w-0 gap-8 lg:grid-cols-[28vh_minmax(0,1fr)]">
        <aside className="flex h-[70dvh] w-full min-h-0 min-w-0 flex-col overflow-hidden lg:sticky lg:top-6 lg:w-[28vh] lg:self-start">
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

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-base p-3">
            <p className="px-3 pb-2 text-label-medium uppercase tracking-[0.08em] text-foreground-muted">
              Components
            </p>
            <nav
              ref={componentNavigationRef}
              aria-label="Component navigation"
              className="scrollbar-design relative flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain"
              data-testid="component-navigation"
            >
              <span
                ref={activeIndicatorRef}
                aria-hidden
                data-testid="component-active-indicator"
                className="pointer-events-none absolute left-0 top-0 z-0 rounded-lg bg-action-active opacity-0 will-change-transform"
              />
              {components.map(({ slug, title }) => (
                <Action
                  key={slug}
                  data-component-nav-item={slug}
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
                  className="relative z-10 justify-start bg-transparent data-[active=true]:bg-transparent data-[active=true]:hover:bg-transparent"
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
          <ComponentSection {...components[7]}>
            <AdminTabsComponentPage embedded />
          </ComponentSection>
          <ComponentSection {...components[8]}>
            <AdminDropdownMenuComponentPage embedded />
          </ComponentSection>
        </div>
      </div>
    </main>
  );
}
