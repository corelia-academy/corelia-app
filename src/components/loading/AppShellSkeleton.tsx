import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteSkeleton } from "@/components/loading/RouteSkeleton";
import { routeSkeletonVariantForPath } from "@/components/loading/routeSkeletonVariant";
import { currentAppPathname } from "@/lib/appUrl";

/**
 * Header + content placeholder sized like `MainLayout` (72px header). Shared by the auth
 * bootstrap screen and the MainLayout chunk fallback so first paint stays one continuous skeleton.
 */
export function AppShellSkeleton({ children }: { children?: ReactNode }) {
  const variant = typeof window === "undefined" ? "home" : routeSkeletonVariantForPath(currentAppPathname());
  return (
    <div className="min-h-svh bg-background" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <header className="flex h-[72px] items-center gap-4 border-b border-border bg-surface-base px-4 sm:px-6">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="ml-auto size-10 rounded-full" />
        <Skeleton className="size-10 rounded-full" />
      </header>
      {/* Like MainLayout's <main>: pages bring their own container. */}
      <main className="min-h-[calc(100svh-72px)] min-w-0">
        {children ?? <RouteSkeleton variant={variant === "learn" ? "home" : variant} />}
      </main>
    </div>
  );
}
