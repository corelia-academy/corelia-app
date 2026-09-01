import { Skeleton } from "@/components/ui/skeleton";

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
  return MINIMAL_ROUTE_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix));
}
/** Neutral first paint while Supabase restores the session. Never renders guest/auth UI prematurely. */
export function AuthBootstrapScreen() {
  if (isMinimalRoute()) {
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

  return (
    <div className="min-h-svh bg-background" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <header className="flex h-[4.75rem] items-center gap-4 border-b border-border bg-surface-base px-4 sm:px-6">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="mx-auto hidden h-10 w-full max-w-xl rounded-full md:block" />
        <Skeleton className="size-10 rounded-full" />
      </header>
      <div className="flex min-h-[calc(100svh-4.75rem)]">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-surface-base p-4 lg:block">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </aside>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
