import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type BinarySidebarTabOption<T extends string> = {
  value: T;
  label: string;
  Icon?: LucideIcon;
  /** Brand/image icon from `public/` (takes precedence over `Icon` when set). */
  iconImgSrc?: string;
  iconImgClassName?: string;
};

export function BinarySidebarTabs<T extends string>(props: {
  active: T;
  onChange: (value: T) => void;
  options: readonly BinarySidebarTabOption<T>[];
  ariaLabel: string;
}) {
  const { active, onChange, options, ariaLabel } = props;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1"
    >
      {options.map(({ value, label, Icon, iconImgSrc, iconImgClassName }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:min-h-12 sm:text-sm",
              selected
                ? "bg-surface-base text-foreground shadow-[var(--elevation-1)]"
                : "text-foreground-muted hover:bg-surface-overlay hover:text-foreground",
            )}
            onClick={() => onChange(value)}
          >
            {iconImgSrc ? (
              <img
                src={iconImgSrc}
                alt=""
                className={cn(
                  "h-6 w-auto max-w-27 shrink-0 object-contain object-left sm:h-8 sm:max-w-36",
                  iconImgClassName,
                )}
                aria-hidden
              />
            ) : Icon ? (
              <Icon className="size-3.5 shrink-0 sm:size-4" aria-hidden />
            ) : null}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
