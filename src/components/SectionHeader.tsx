import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** Tiêu đề nhóm: tiêu đề (kèm icon nếu có), hành động bên phải và đường kẻ. */
export function SectionHeader({
  title,
  titleId,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  titleId?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon}
          <h2 id={titleId} data-profile-heading className="text-base font-medium text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <Separator className="border-stroke-divider" />
    </header>
  );
}
