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
      {/* Mirrors the guest login page: max-w-4xl card with the form and the brand banner. */}
      <div className="w-full max-w-sm md:max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-24 bg-white/15" />
          <Skeleton className="h-8 w-16 bg-white/15" />
        </div>
        <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-surface-base/60 md:grid-cols-2">
          <div className="space-y-5 p-6 md:p-8">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="mx-auto h-4 w-40" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          </div>
          <Skeleton className="hidden rounded-none md:block" />
        </div>
      </div>
    </div>
  );
}
