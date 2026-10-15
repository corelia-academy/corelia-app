import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { skeletonRevealClass } from "./skeletonReveal";

/**
 * Login page placeholder (auth background + centered card). Used by the bootstrap screen, the
 * route fallback and the login page itself while the session/MFA check resolves.
 */
export function AuthPageSkeleton() {
  return (
    <div
      className={cn(
        "flex min-h-svh flex-col items-center justify-center public-status bg-auth-page p-6 md:p-10",
        skeletonRevealClass(),
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      <div className="w-full max-w-sm md:max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-24 bg-white/15" />
          <Skeleton className="h-8 w-16 bg-white/15" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}
