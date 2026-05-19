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
          className="rounded-lg border border-border-subtle bg-surface-base p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary" aria-hidden>
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {item.label}
              </div>
              <div className="mt-1 wrap-break-word text-sm font-medium leading-snug text-foreground">
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
          className="rounded-lg border border-border-subtle bg-surface-base p-4"
        >
          <div className="text-sm font-medium leading-snug text-foreground">
            {row.title}
          </div>
          <div className="mt-1.5 wrap-break-word text-sm leading-snug text-foreground-muted">
            {row.datetimeLabel}
          </div>
        </li>
      ))}
    </ol>
  );
}
