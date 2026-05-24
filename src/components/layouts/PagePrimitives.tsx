import React from "react";
import { cn } from "@/lib/utils";

type PageWidth = "wide" | "default" | "narrow";

const WIDTH_CLASS: Record<PageWidth, string> = {
  wide: "max-w-screen-2xl",
  default: "max-w-7xl",
  narrow: "max-w-5xl",
};

export function PageContainer({
  children,
  className,
  width = "wide",
}: {
  children: React.ReactNode;
  className?: string;
  width?: PageWidth;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 px-4 py-4 sm:px-6 sm:py-5 lg:px-8",
        WIDTH_CLASS[width],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageSectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

