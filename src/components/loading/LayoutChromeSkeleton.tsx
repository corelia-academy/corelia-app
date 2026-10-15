import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Admin / instructor workspace chrome (17.5rem sidebar from `md`, h-11 sticky bar) around a
 * page placeholder, so the bar does not push the skeleton down when the layout mounts.
 */
export function WorkspaceChromeSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100svh-72px)] w-full">
      <aside className="hidden w-[17.5rem] shrink-0 space-y-3 border-r border-border-subtle bg-sidebar p-3 md:block" aria-hidden>
        <Skeleton className="h-[4.5rem] w-full rounded-lg" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-md" />
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex h-11 items-center gap-2 border-b border-border-subtle bg-surface-raised/90 px-3 md:px-4" aria-hidden>
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 w-40" />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Account area chrome (section nav + mobile section card) around a bare page placeholder. */
export function AccountChromeSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="container-app pb-6 pt-4 sm:py-8">
      <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-72 lg:shrink-0" aria-hidden>
          <Skeleton className="mb-4 hidden h-3 w-28 lg:block" />
          <div className="flex gap-2 overflow-hidden pb-1 lg:hidden">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-28 shrink-0 rounded-full" />
            ))}
          </div>
          <div className="hidden gap-2 rounded-2xl border border-border-subtle bg-surface-base p-2 shadow-card lg:grid">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-2xl lg:hidden" aria-hidden />
          {children}
        </div>
      </div>
    </div>
  );
}
