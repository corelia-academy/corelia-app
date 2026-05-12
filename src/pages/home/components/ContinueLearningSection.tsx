import { ArrowRight, BookOpen } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import type { FocusCard } from "../utils/homeTypes";

export function ContinueLearningSection({
  t,
  focusCards,
}: {
  t: TFunction<"common">;
  focusCards: FocusCard[];
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">{t("home.continueLearning")}</h2>
        <Button
          render={<NavLink to="/courses" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-mr-2"
        >
          {t("home.sections.seeAll")}
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {focusCards.length > 0 ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {focusCards.map((item) => (
            <NavLink
              key={item.id}
              to={item.action}
              className="min-w-[240px] max-w-[240px] cursor-pointer rounded-lg border border-border-subtle bg-surface-base p-3 transition-all duration-200 ease-out hover:bg-surface-raised hover:-translate-y-0.5"
            >
              <div className="line-clamp-2 text-sm font-medium text-foreground">
                {item.title}
              </div>
              <div className="mt-1 line-clamp-1 text-xs text-foreground-muted">
                {item.meta}
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-foreground-muted">
                  <span>{t("home.sections.progress")}</span>
                  <span>{item.progress}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
              <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground-muted">
                {item.nextStep}
              </div>
            </NavLink>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-3 py-8 text-center sm:py-12">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
            <BookOpen className="size-6 text-foreground-subtle" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("home.sections.startFromCatalogTitle")}
            </p>
            <p className="mt-0.5 text-xs text-foreground-muted">{t("home.sections.enrollHint")}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            render={<NavLink to="/courses" />}
            nativeButton={false}
          >
            {t("home.exploreCourses")}
          </Button>
        </div>
      )}
    </section>
  );
}

