import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { gsap } from "gsap";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import AdminActionComponentPage from "./components/AdminActionComponentPage";
import AdminAvatarComponentPage from "./components/AdminAvatarComponentPage";
import AdminBadgeComponentPage from "./components/AdminBadgeComponentPage";
import AdminButtonComponentPage from "./components/AdminButtonComponentPage";
import AdminDropdownMenuComponentPage from "./components/AdminDropdownMenuComponentPage";
import AdminEmptyStateIllustrationComponentPage from "./components/AdminEmptyStateIllustrationComponentPage";
import AdminFullPageEmptyStateComponentPage from "./components/AdminFullPageEmptyStateComponentPage";
import AdminProgressComponentPage from "./components/AdminProgressComponentPage";
import AdminXpRankComponentPage from "./components/AdminXpRankComponentPage";
import AdminInputFieldComponentPage from "./components/AdminInputFieldComponentPage";
import AdminScrollbarComponentPage from "./components/AdminScrollbarComponentPage";
import AdminSelectionComponentPage from "./components/AdminSelectionComponentPage";
import AdminSeparatorComponentPage from "./components/AdminSeparatorComponentPage";
import AdminTagComponentPage from "./components/AdminTagComponentPage";
import AdminTabsComponentPage from "./components/AdminTabsComponentPage";
import AdminToggleComponentPage from "./components/AdminToggleComponentPage";
import AdminComponentsSidebar from "./components/AdminComponentsSidebar";

const components = [
  {
    slug: "action",
    title: "Action",
    criterion: "Variants, active state, pressed state, content slots, and disabled behavior.",
  },
  {
    slug: "avatar",
    title: "Avatar",
    criterion: "Nine Figma sizes, six avatar types, image/text/icon fallbacks, brand logos, actions, and User states.",
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
  {
    slug: "input-field",
    title: "Input Field",
    criterion: "Five field compositions, validation, counters, selectable tags, dropdown selectors, icons, and disabled/focused states.",
  },
  {
    slug: "button",
    title: "Button",
    criterion:
      "Review hierarchy, sizing, states, and composition with the existing form controls.",
  },
  {
    slug: "empty-state-illustration",
    title: "Empty State Illustration",
    criterion: "Two illustration types across tiny, medium, and large sizes.",
  },
  {
    slug: "progress",
    title: "Progress",
    criterion: "Figma sizes, progress levels, and color models for progress bars and circles.",
  },
  {
    slug: "xp-rank",
    title: "XP Rank",
    criterion: "All six ranks at 80, 160, and 200 px sizes.",
  },
  {
    slug: "full-page-empty-state",
    title: "Full Page Empty State",
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
  const { t } = useTranslation("common");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const pathnameSlug = pathname.split("/").at(-1);
  const routeSlug = components.find(({ slug }) => slug === pathnameSlug)?.slug ?? null;
  const isFullPageEmptyState = routeSlug === "full-page-empty-state";
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

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousScrollbarGutter = root.style.scrollbarGutter;

    root.style.scrollbarGutter = "stable";

    return () => {
      root.style.scrollbarGutter = previousScrollbarGutter;
    };
  }, []);

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

    if (!routeSlug || routeSlug === "full-page-empty-state") return;

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
    if (
      isFullPageEmptyState ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

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
  }, [isFullPageEmptyState]);

  return (
    <main
      className={
        isFullPageEmptyState
          ? "container-app min-h-svh"
          : "container-app min-h-screen space-y-8 py-6 sm:py-8"
      }
    >
      {!isFullPageEmptyState ? (
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
      ) : null}

      <div
        className={`grid min-w-0 gap-8 lg:grid-cols-[28vh_minmax(0,1fr)] ${
          isFullPageEmptyState ? "min-h-svh" : ""
        }`}
      >
        <AdminComponentsSidebar
          components={components}
          activeComponent={activeComponent}
          componentNavigationRef={componentNavigationRef}
          activeIndicatorRef={activeIndicatorRef}
          resolvedTheme={resolvedTheme}
          onBack={() => navigate("/")}
          onThemeChange={setTheme}
          onSelectComponent={(slug) => {
            setActiveComponent(slug);
            if (
              routeSlug === slug &&
              slug !== "full-page-empty-state"
            ) {
              beginProgrammaticScroll(slug);
            }
          }}
        />

        <div
          className={
            isFullPageEmptyState
              ? "min-w-0"
              : "min-w-0 space-y-10"
          }
          data-testid="component-sections"
        >
          {isFullPageEmptyState ? (
            <AdminFullPageEmptyStateComponentPage />
          ) : (
            <>
              <ComponentSection {...components[0]}>
                <AdminActionComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[1]}>
                <AdminAvatarComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[2]}>
                <AdminBadgeComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[3]}>
                <AdminTagComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[4]}>
                <AdminSelectionComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[5]}>
                <AdminToggleComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[6]}>
                <AdminSeparatorComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[7]}>
                <AdminScrollbarComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[8]}>
                <AdminTabsComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[9]}>
                <AdminDropdownMenuComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[10]}>
                <AdminInputFieldComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[11]}>
                <AdminButtonComponentPage />
              </ComponentSection>
              <ComponentSection {...components[12]}>
                <AdminEmptyStateIllustrationComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[13]} title={t("componentShowcase.progress.title")} criterion={t("componentShowcase.progress.criterion")}>
                <AdminProgressComponentPage embedded />
              </ComponentSection>
              <ComponentSection {...components[14]} title={t("componentShowcase.xpRank.title")} criterion={t("componentShowcase.xpRank.criterion")}>
                <AdminXpRankComponentPage embedded />
              </ComponentSection>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
