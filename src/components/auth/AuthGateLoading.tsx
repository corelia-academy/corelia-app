import { cn } from "@/lib/utils";

type AuthGateLoadingProps = {
  className?: string;
  /** Tailwind min-height for the centered area (default matches route guards). */
  minHeightClass?: string;
};

/**
 * Spinner used while auth/session is not ready (`authInitialized`), role/profile gate,
 * or a lazy route chunk is loading. Keeps one visual pattern instead of mixing spinners + “Loading…”.
 */
export function AuthGateLoading({
  className,
  minHeightClass = "min-h-[200px]",
}: AuthGateLoadingProps) {
  return (
    <div
      className={cn("flex items-center justify-center", minHeightClass, className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      <div
        className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden
      />
    </div>
  );
}
