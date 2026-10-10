import type { RefObject } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Action } from "@/components/ui/action";
import { Button } from "@/components/ui/button";

type SidebarComponent<TSlug extends string> = {
  slug: TSlug;
  title: string;
};

type AdminComponentsSidebarProps<TSlug extends string> = {
  components: readonly SidebarComponent<TSlug>[];
  activeComponent: string;
  componentNavigationRef: RefObject<HTMLElement | null>;
  activeIndicatorRef: RefObject<HTMLSpanElement | null>;
  resolvedTheme: string | undefined;
  onBack: () => void;
  onThemeChange: (theme: "light" | "dark") => void;
  onSelectComponent: (slug: TSlug) => void;
};

export default function AdminComponentsSidebar<TSlug extends string>({
  components,
  activeComponent,
  componentNavigationRef,
  activeIndicatorRef,
  resolvedTheme,
  onBack,
  onThemeChange,
  onSelectComponent,
}: AdminComponentsSidebarProps<TSlug>) {
  const { t } = useTranslation("common");

  return (
    <aside className="flex h-[70dvh] w-full min-h-0 min-w-0 flex-col lg:sticky lg:top-6 lg:w-[28vh] lg:self-start">
      <Button
        type="button"
        variant="cta" hierarchy="secondary"
        size="small"
        className="w-fit justify-start"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden />
        Back to app
      </Button>

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-clip rounded-lg border border-border-subtle bg-surface-base p-3">
        <p className="px-3 pb-2 text-label-medium uppercase tracking-[0.08em] text-foreground-muted">
          Components
        </p>
        <nav
          ref={componentNavigationRef}
          aria-label="Component navigation"
          className="scrollbar-design relative flex min-h-0 flex-1 flex-col gap-1 overflow-x-auto overflow-y-auto overscroll-contain"
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
                  aria-current={activeComponent === slug ? "page" : undefined}
                />
              }
              label={
                slug === "progress"
                  ? t("componentShowcase.progress.title")
                  : slug === "xp-rank"
                    ? t("componentShowcase.xpRank.title")
                    : slug === "full-page-empty-state"
                      ? t("componentShowcase.fullPageEmptyState.title")
                      : slug === "tooltip"
                        ? t("componentShowcase.tooltip.title")
                        : slug === "stepper"
                          ? t("componentShowcase.stepper.title")
                          : title
              }
              size="small"
              isActive={activeComponent === slug}
              className="relative z-10 justify-start bg-transparent data-[active=true]:bg-transparent data-[active=true]:hover:bg-transparent"
              onClick={() => onSelectComponent(slug)}
            />
          ))}
        </nav>
      </div>

      <div className="mt-auto flex shrink-0 gap-2 pt-6">
        {(["light", "dark"] as const).map((theme) => (
          <Button
            key={theme}
            type="button"
            size="small"
            variant="cta" hierarchy="secondary"
            data-testid={`theme-toggle-${theme}`}
            aria-pressed={resolvedTheme === theme}
            onClick={() => onThemeChange(theme)}
          >
            {theme === "light" ? "Light" : "Dark"}
          </Button>
        ))}
      </div>
    </aside>
  );
}
