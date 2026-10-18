import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteSkeleton } from "@/components/loading/RouteSkeleton";
import { routeSkeletonVariantForPath } from "@/components/loading/routeSkeletonVariant";
import { currentAppPathname } from "@/lib/appUrl";

/**
 * Header + sidebar + content placeholder sized like `MainLayout` (72px header, 15rem sidebar
 * from `lg`). Shared by the auth bootstrap screen and the MainLayout chunk fallback so first
 * paint stays one continuous skeleton.
 */
export function AppShellSkeleton({ children }: { children?: ReactNode }) {
  const variant = typeof window === "undefined" ? "home" : routeSkeletonVariantForPath(currentAppPathname());
  return (
    <div className="min-h-svh bg-background" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <header className="flex h-[72px] items-center gap-4 border-b border-border bg-surface-base px-4 sm:px-6">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="mx-auto hidden h-10 w-full max-w-xl rounded-full md:block" />
        <Skeleton className="size-10 rounded-full" />
      </header>
      <div className="flex min-h-[calc(100svh-72px)]">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-surface-base p-4 lg:block">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </aside>
        {/* Like MainLayout's SidebarInset: pages bring their own container. */}
        <main className="min-w-0 flex-1">
          {children ?? <RouteSkeleton variant={variant === "learn" ? "home" : variant} />}
        </main>
      </div>
    </div>
  );
}
