import type { ReactNode } from "react";

type TimelineItem = {
  key: string;
  label: string;
  value: string;
  icon: ReactNode;
};

export type ContestTimelineRow = {
  key: string;
  title: string;
  datetimeLabel: string;
};

export function ContestTimeline({
  items,
}: {
  items: TimelineItem[];
}) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4">
      {items.map((item) => (
        <li
          key={item.key}
          className="group/timeline rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4.5 transition-[transform,background-color,border-color,box-shadow] duration-300 hover:-translate-y-[2px] hover:shadow-md hover:border-primary/25"
        >
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary group-hover/timeline:bg-primary group-hover/timeline:text-primary-foreground transition-[transform,background-color,border-color,box-shadow] duration-300 shadow-2xs" aria-hidden>
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted group-hover/timeline:text-primary transition-colors">
                {item.label}
              </div>
              <div className="mt-1.5 wrap-break-word text-sm font-semibold leading-snug text-foreground">
                {item.value}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ContestTimelineVertical({ rows }: { rows: ContestTimelineRow[] }) {
  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
      {rows.map((row) => (
        <li
          key={row.key}
          className="group/timeline rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4.5 pl-5 relative transition-[transform,background-color,border-color,box-shadow] duration-300 hover:-translate-y-[2px] hover:shadow-md hover:border-primary/25 border-l-3 border-l-primary/30 hover:border-l-primary"
        >
          <div className="text-sm font-semibold leading-snug text-foreground group-hover/timeline:text-primary transition-colors">
            {row.title}
          </div>
          <div className="mt-2 wrap-break-word text-sm leading-snug text-foreground-muted">
            {row.datetimeLabel}
          </div>
        </li>
      ))}
    </ol>
  );
}
