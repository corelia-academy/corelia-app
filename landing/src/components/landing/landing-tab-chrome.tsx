import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LandingTabItem = { key: string; label: string };

/** Desktop tab strip — markup mirrors the original Why section (`why.tsx`). */
export function LandingTabRow({
  columns,
  tabs,
  activeKey,
  onSelect,
  ariaLabel,
}: {
  columns: 3 | 4;
  tabs: LandingTabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-1 text-center items-end",
        columns === 3 ? "grid-cols-3 text-[11px] lg:text-xs" : "grid-cols-4 text-xs",
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeKey === tab.key}
          id={`landing-tab-${tab.key}`}
          className={cn(
            "m-0 w-full rounded-tl-[24px] border-t border-r border-l border-border rounded-tr-[24px] bg-card p-2 text-center font-[family:inherit] leading-[inherit] text-[length:inherit] tracking-[inherit] cursor-pointer h-fit transition-all duration-300",
            "appearance-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            activeKey === tab.key &&
              (columns === 3 ? "text-sm lg:text-base" : "text-base"),
          )}
          onClick={() => onSelect(tab.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(tab.key);
            }
          }}
        >
          <span
            className={cn(
              "block whitespace-normal leading-snug px-0.5",
              activeKey === tab.key && "bg-foreground/15 p-3 rounded-[16px]",
            )}
          >
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Panel wrapper under the tab row — matches Why / Program sections. */
export function LandingTabPanelShell({
  children,
  variant = "desktop",
  innerClassName,
}: {
  children: ReactNode;
  variant?: "desktop" | "mobile";
  innerClassName?: string;
}) {
  const inner = cn(
    variant === "desktop"
      ? "p-8 bg-background rounded-[36px]"
      : "p-6 bg-background rounded-[20px]",
    innerClassName,
  );
  return (
    <div className="p-2 bg-card border border-border rounded-bl-[40px] rounded-br-[40px]">
      <div className={inner}>{children}</div>
    </div>
  );
}

/** Mobile stacked sections — same header treatment as Why on small screens. */
export function LandingMobileSectionHeader({ label }: { label: string }) {
  return (
    <div className="rounded-tl-[24px] border-t border-r border-l border-border rounded-tr-[24px] p-2 bg-card transition-all duration-300">
      <p className="bg-foreground/15 p-3 rounded-[16px] text-base text-center">
        {label}
      </p>
    </div>
  );
}
