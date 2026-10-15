import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function DefaultShellContent() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Header + sidebar + content placeholder sized like `MainLayout` (72px header, 15rem sidebar
 * from `lg`). Shared by the auth bootstrap screen and the MainLayout chunk fallback so first
 * paint stays one continuous skeleton.
 */
export function AppShellSkeleton({ children }: { children?: ReactNode }) {
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
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {children ?? <DefaultShellContent />}
        </main>
      </div>
    </div>
  );
}
