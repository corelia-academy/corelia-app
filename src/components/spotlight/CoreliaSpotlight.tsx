import { ArrowRight } from "lucide-react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

export type CoreliaSpotlightItem = {
  id: string;
  badge: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  meta?: string;
  icon?: React.ReactNode;
  accent?: "amber" | "emerald" | "sky";
};

const accentClassNames: Record<
  NonNullable<CoreliaSpotlightItem["accent"]>,
  {
    shell: string;
    icon: string;
  }
> = {
  amber: {
    shell:
      "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--warning)_10%,transparent),transparent_55%)]",
    icon: "bg-warning/12 text-warning",
  },
  emerald: {
    shell:
      "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--success)_10%,transparent),transparent_55%)]",
    icon: "bg-success/12 text-success",
  },
  sky: {
    shell:
      "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_55%)]",
    icon: "bg-primary/10 text-primary",
  },
};

export function CoreliaSpotlight({
  eyebrow = "Corelia Spotlight",
  title,
  description,
  items,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  items: CoreliaSpotlightItem[];
  compact?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-5 sm:p-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
          {eyebrow}
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-foreground-muted">
          {description}
        </p>
      </div>

      <div
        className={cn(
          "mt-6 grid gap-4",
          compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {items.map((item) => {
          const accent = accentClassNames[item.accent ?? "sky"];
          return (
            <NavLink
              key={item.id}
              to={item.href}
              className={cn(
                "group cursor-pointer overflow-hidden rounded-lg border border-border-subtle p-4 transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-border hover:bg-surface-raised",
                accent.shell,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-full border border-border bg-surface-base px-3 py-1 text-xs font-medium uppercase tracking-widest text-foreground-muted">
                  {item.badge}
                </div>
                {item.icon ? (
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-md",
                      accent.icon,
                    )}
                  >
                    {item.icon}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 text-lg font-semibold leading-snug text-foreground">
                {item.title}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-foreground-muted">
                {item.description}
              </div>

              {item.meta ? (
                <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-base shadow-card px-3 py-2 text-xs text-foreground-muted">
                  {item.meta}
                </div>
              ) : null}

              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <span>{item.ctaLabel}</span>
                <ArrowRight
                  className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </div>
            </NavLink>
          );
        })}
      </div>
    </section>
  );
}
