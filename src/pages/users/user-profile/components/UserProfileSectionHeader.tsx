import type { ReactNode } from "react";

export function UserProfileSectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 data-profile-heading className="text-base font-medium text-foreground">{title}</h2>
        {action}
      </div>
      <div className="h-px w-full bg-stroke-divider" />
    </header>
  );
}
