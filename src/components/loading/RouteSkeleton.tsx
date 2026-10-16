import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { skeletonRevealClass } from "./skeletonReveal";

import type { RouteSkeletonVariant } from "./routeSkeletonVariant";

export type { RouteSkeletonVariant };

type RouteSkeletonProps = {
  variant: RouteSkeletonVariant;
  className?: string;
  /** Skip the page container/padding when the parent layout already provides it. */
  bare?: boolean;
};

function LoadingStatus({
  className,
  children,
  immediate = false,
}: {
  className?: string;
  children: ReactNode;
  /** Show at once (first paint) instead of after the anti-flash delay. */
  immediate?: boolean;
}) {
  return (
    <div
      className={cn(skeletonRevealClass(immediate), className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

function HomeContent() {
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

function ListContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-border-subtle p-3">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailContent() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3 rounded-lg" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function FormContent() {
  return (
    <div className="max-w-3xl space-y-6">
      <Skeleton className="h-8 w-56 rounded-lg" />
      <div className="space-y-5 rounded-2xl border border-border-subtle p-4 sm:p-6">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function TableContent() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <div className="divide-y divide-border-subtle rounded-2xl border border-border-subtle">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 p-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Lesson player body, mirroring `LessonPlayerCard`: format label, title and summary above the
 * lesson media, then the sticky Previous / lesson number / primary action footer.
 */
export function LessonPlayerSkeletonBody() {
  return (
    <div className="flex min-h-full flex-col" aria-hidden>
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-3 h-8 w-3/4 max-w-xl rounded-lg" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        </div>
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
      <div className="sticky bottom-0 border-t border-border bg-surface-base px-3 pb-3 pt-2 sm:px-6 sm:pt-3">
        <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[auto_1fr_auto] sm:gap-3">
          <Skeleton className="h-11 w-full rounded-lg sm:w-28" />
          <Skeleton className="mx-auto hidden h-4 w-16 sm:block" />
          <Skeleton className="h-11 w-full rounded-lg sm:w-28" />
        </div>
      </div>
    </div>
  );
}

/** Full Learn screen: h-12 top bar, lesson player and (from 1280px) the curriculum panel. */
export function LearnShellSkeleton({ className, immediate }: { className?: string; immediate?: boolean }) {
  return (
    <LoadingStatus className={cn("flex h-full flex-col bg-background", className)} immediate={immediate}>
      {/* Top bar sits on surface-raised, so its placeholders use the darker base tone to stay visible. */}
      <div className="relative flex h-12 shrink-0 items-center border-b border-border-subtle bg-surface-raised px-3" aria-hidden>
        <Skeleton className="size-8 rounded-md bg-surface-base" />
        <Skeleton className="absolute left-1/2 h-4 w-64 max-w-[50%] -translate-x-1/2 bg-surface-base" />
        <Skeleton className="ml-auto size-8 rounded-md bg-surface-base" />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          <LessonPlayerSkeletonBody />
        </div>
        <div className="hidden w-[24%] shrink-0 flex-col border-l border-border-subtle bg-surface-base xl:flex" aria-hidden>
          <div className="grid grid-cols-2 gap-1 border-b border-border-subtle p-2">
            <Skeleton className="h-8 rounded-md" />
            <Skeleton className="h-8 rounded-md" />
          </div>
          <div className="border-b border-border-subtle bg-surface-raised px-4 py-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 bg-surface-base" />
              <Skeleton className="h-3 w-8 bg-surface-base" />
            </div>
            <Skeleton className="mt-2 h-1.5 w-full rounded-full bg-surface-base" />
            <Skeleton className="mt-2 h-3 w-24 bg-surface-base" />
          </div>
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="size-5 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingStatus>
  );
}

const CONTENT_BY_VARIANT: Record<Exclude<RouteSkeletonVariant, "learn">, () => ReactNode> = {
  home: HomeContent,
  list: ListContent,
  detail: DetailContent,
  form: FormContent,
  table: TableContent,
};

/**
 * Route-level placeholder shaped like the page type it stands in for. Renders only the
 * content area: layouts keep their header/sidebar while a lazy route chunk loads.
 */
export function RouteSkeleton({ variant, className, bare = false }: RouteSkeletonProps) {
  if (variant === "learn") return <LearnShellSkeleton className={className} />;
  const Content = CONTENT_BY_VARIANT[variant];
  return (
    <LoadingStatus className={cn(!bare && "container-app py-6 sm:py-8", className)}>
      <Content />
    </LoadingStatus>
  );
}

/** Inline placeholder rows for a list/table section whose page chrome is already rendered. */
export function ListRowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <LoadingStatus className={cn("divide-y divide-border-subtle", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="hidden h-8 w-20 rounded-lg sm:block" />
        </div>
      ))}
    </LoadingStatus>
  );
}
