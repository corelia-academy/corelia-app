import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Calendar, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContestListCardThumbnail({
  src,
  alt = "",
  aspectClassName,
  surfaceClassName,
  emptyMinHeightClassName,
  trophyIconClassName,
}: {
  src: string | null | undefined;
  alt?: string;
  aspectClassName: string;
  surfaceClassName: string;
  emptyMinHeightClassName: string;
  trophyIconClassName: string;
}) {
  return (
    <div className={cn("relative w-full", aspectClassName, surfaceClassName)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          aria-hidden={!alt.trim()}
        />
      ) : (
        <div
          className={cn(
            "flex h-full items-center justify-center",
            emptyMinHeightClassName,
          )}
        >
          <Trophy className={trophyIconClassName} aria-hidden />
        </div>
      )}
    </div>
  );
}

export function ContestListCardDateRowCatalog({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border-subtle bg-surface-base px-3 py-2">
      <Calendar className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function ContestListCardDateRowInstructor({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-base px-3 py-2">
      {children}
    </div>
  );
}

export function ContestListMetricCellCatalog({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border-subtle bg-surface-base px-3 py-2">
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function ContestListMetricCellInstructor({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-base px-3 py-2">
      {children}
    </div>
  );
}
