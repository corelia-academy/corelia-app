import type { LucideIcon } from "lucide-react";

type MomentumCard = {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
};

export function MomentumCards({
  items,
}: {
  items: MomentumCard[];
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-md border border-border-subtle bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">
                  {item.value}
                </div>
                <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {item.note}
                </div>
              </div>
              <div className="flex size-9 items-center justify-center rounded-md bg-primary-container text-on-primary-container">
                <Icon className="size-4 shrink-0" aria-hidden />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

