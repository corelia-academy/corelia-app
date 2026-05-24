import React from "react";

export function AdminStatsCard({
  label,
  value,
  icon,
  iconClassName,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-foreground-muted">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
        </div>
        <div
          className={
            iconClassName ??
            "flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"
          }
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

