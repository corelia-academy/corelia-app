import { useEffect } from "react";
import { NavLink } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  MapPinned,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function RoadmapColumn({
  title,
  items,
  tone,
  icon: Icon,
}: {
  title: string;
  items: string[];
  tone: "done" | "active" | "planned";
  icon: LucideIcon;
}) {
  const toneClass =
    tone === "done"
      ? "border-emerald-500/25 bg-emerald-500/5"
      : tone === "active"
        ? "border-primary/30 bg-primary-muted/40"
        : "border-border-subtle bg-surface-base";

  const iconClass =
    tone === "done"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "active"
        ? "text-primary"
        : "text-foreground-muted";

  return (
    <section
      className={cn(
        "rounded-lg border p-4 sm:p-5",
        toneClass,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("size-5 shrink-0", iconClass)} aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-foreground-muted">
        {items.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-60" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RoadmapPage() {
  const { t } = useTranslation("common");

  const shipped = asStringList(
    t("roadmap.shippedItems", { returnObjects: true }),
  );
  const inProgress = asStringList(
    t("roadmap.inProgressItems", { returnObjects: true }),
  );
  const planned = asStringList(
    t("roadmap.plannedItems", { returnObjects: true }),
  );

  useEffect(() => {
    const prev = document.title;
    document.title = `${t("roadmap.documentTitle")} · ${t("appName")}`;
    return () => {
      document.title = prev;
    };
  }, [t]);

  return (
    <div className="container-app w-full min-w-0 py-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
              <Sparkles className="size-3.5 shrink-0" aria-hidden />
              {t("roadmap.badge")}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("roadmap.title")}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted sm:text-base">
              {t("roadmap.intro")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            render={<NavLink to="/" />}
            nativeButton={false}
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("roadmap.backHome")}
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <RoadmapColumn
            title={t("roadmap.shippedTitle")}
            items={shipped}
            tone="done"
            icon={CheckCircle2}
          />
          <RoadmapColumn
            title={t("roadmap.inProgressTitle")}
            items={inProgress}
            tone="active"
            icon={CircleDot}
          />
          <RoadmapColumn
            title={t("roadmap.plannedTitle")}
            items={planned}
            tone="planned"
            icon={MapPinned}
          />
        </div>

        <p className="text-center text-xs leading-relaxed text-foreground-muted">
          {t("roadmap.footerNote")}
        </p>
      </div>
    </div>
  );
}
