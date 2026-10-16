import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { skeletonRevealClass } from "./skeletonReveal";

/**
 * Login page placeholder (auth background + centered spinner). Used by the bootstrap screen, the
 * route fallback and the login page itself while the session/MFA check resolves.
 */
export function AuthPageSkeleton() {
  return (
    <div
      className={cn(
        "flex min-h-svh items-center justify-center public-status bg-auth-page p-6",
        skeletonRevealClass(),
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      <Loader2 className="size-8 animate-spin text-white/70" aria-hidden />
    </div>
  );
}
