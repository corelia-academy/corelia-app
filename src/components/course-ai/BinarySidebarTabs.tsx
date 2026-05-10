import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function BinarySidebarTabs<T extends string>(props: {
  active: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; Icon?: LucideIcon }[];
  ariaLabel: string;
}) {
  const { active, onChange, options, ariaLabel } = props;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1"
    >
      {options.map(({ value, label, Icon }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
              selected
                ? "bg-surface-base text-foreground shadow-[var(--elevation-1)]"
                : "text-foreground-muted hover:bg-surface-overlay hover:text-foreground",
            )}
            onClick={() => onChange(value)}
          >
            {Icon ? <Icon className="size-3.5 shrink-0 sm:size-4" aria-hidden /> : null}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
