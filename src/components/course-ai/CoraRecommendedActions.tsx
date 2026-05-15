import { ArrowUpRight, Compass } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { CoraRecommendedAction } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";

export function CoraRecommendedActions({
  actions,
  className,
}: {
  actions: CoraRecommendedAction[];
  className?: string;
}) {
  const { t } = useTranslation("common");

  if (actions.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-border-subtle bg-surface-raised p-3", className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
        <Compass className="size-3.5" aria-hidden />
        {t("coraWidget.recommendedActions.title")}
      </div>
      <div className="mt-3 grid gap-2">
        {actions.map((action) => (
          <div
            key={`${action.to}-${action.label}`}
            className="rounded-md border border-border-subtle bg-background/60 p-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{action.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
                  {action.reason}
                </p>
              </div>
              <Button
                render={<NavLink to={action.to} />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="shrink-0"
              >
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
