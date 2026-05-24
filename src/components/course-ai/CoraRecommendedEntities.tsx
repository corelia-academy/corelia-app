import { ArrowUpRight, BookOpen, Briefcase, Flag } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { CoraRecommendedEntity } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";

function iconFor(kind: CoraRecommendedEntity["kind"]) {
  if (kind === "career") return Briefcase;
  if (kind === "hackathon") return Flag;
  return BookOpen;
}

export function CoraRecommendedEntities({
  entities,
  className,
}: {
  entities: CoraRecommendedEntity[];
  className?: string;
}) {
  const { t } = useTranslation("common");

  if (entities.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-border-subtle bg-surface-raised p-3", className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
        <BookOpen className="size-3.5" aria-hidden />
        {t("coraWidget.recommendedEntities.title")}
      </div>
      <div className="mt-3 grid gap-2">
        {entities.map((entity) => {
          const Icon = iconFor(entity.kind);
          return (
            <div
              key={`${entity.kind}-${entity.to}-${entity.title}`}
              className="rounded-md border border-border-subtle bg-background/60 p-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="size-3.5 text-foreground-muted" aria-hidden />
                    <p className="text-xs font-medium text-foreground">{entity.title}</p>
                    {entity.badge ? (
                      <span className="rounded-full border border-border-subtle bg-surface-base px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                        {entity.badge}
                      </span>
                    ) : null}
                  </div>
                  {entity.subtitle ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
                      {entity.subtitle}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
                    {entity.reason}
                  </p>
                </div>
                <Button
                  render={<NavLink to={entity.to} />}
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  aria-label={entity.title}
                >
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
