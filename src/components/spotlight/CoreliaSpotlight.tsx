import { ArrowRight } from "@phosphor-icons/react";
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
    <section className="rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-2">
        <div className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="text-xl font-normal tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-3xl text-[14px] leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      <div
        className={cn(
          "mt-5 grid gap-4",
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
                "group overflow-hidden rounded-[24px] border border-border-subtle p-4 transition hover:border-border hover:bg-muted/30",
                accent.shell,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-full border border-border-subtle bg-background/85 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {item.badge}
                </div>
                {item.icon ? (
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-2xl",
                      accent.icon,
                    )}
                  >
                    {item.icon}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 text-[17px] font-medium leading-snug text-foreground">
                {item.title}
              </div>
              <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                {item.description}
              </div>

              {item.meta ? (
                <div className="mt-4 rounded-2xl border border-border-subtle bg-background/80 px-3 py-2 text-[12px] text-muted-foreground">
                  {item.meta}
                </div>
              ) : null}

              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <span>{item.ctaLabel}</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </NavLink>
          );
        })}
      </div>
    </section>
  );
}
