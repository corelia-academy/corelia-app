import type { ReactNode } from "react";
import { AppShellSkeleton } from "@/components/loading/AppShellSkeleton";
import { LearnShellSkeleton } from "@/components/loading/RouteSkeleton";
import { isStandalonePlaceholderPath, routeSkeletonVariantForPath } from "@/components/loading/routeSkeletonVariant";
import { Skeleton } from "@/components/ui/skeleton";
import { currentAppPathname } from "@/lib/appUrl";

const MINIMAL_ROUTE_PREFIXES = [
  "/login",
  "/confirm-signup",
  "/auth/",
  "/verify",
  "/claim",
  "/email/unsubscribe",
  "/ocid-redirect",
];

function isMinimalRoute(): boolean {
  if (typeof window === "undefined") return false;
  return MINIMAL_ROUTE_PREFIXES.some((prefix) => currentAppPathname().startsWith(prefix));
}
/** Neutral first paint while Supabase restores the session. Never renders guest/auth UI prematurely. */
export function AuthBootstrapScreen({ content }: { content?: ReactNode }) {
  if (isMinimalRoute()) {
    if (content && isStandalonePlaceholderPath(currentAppPathname())) return <>{content}</>;
    return (
      <main
        className="flex min-h-svh items-center justify-center bg-background px-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Loading</span>
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="mx-auto h-10 w-40 rounded-lg" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  // Match the route about to render so the shape does not change again after boot.
  if (routeSkeletonVariantForPath(currentAppPathname()) === "learn") {
    return (
      <div className="h-dvh overflow-hidden bg-background">
        <LearnShellSkeleton immediate />
      </div>
    );
  }
  return <AppShellSkeleton>{content}</AppShellSkeleton>;
}
