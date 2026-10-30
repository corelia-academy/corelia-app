import type { ReactNode } from "react";
import { AppHeaderBar } from "@/components/layouts/AppHeaderBar";
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
 * Lesson player body, mirroring `LessonPlayerCard` with its content frame: the video runs edge to
 * edge on top, then the text frame (format label, title, summary) with the same width and padding
 * as the frame in `LessonRenderer`. The floating action bar is drawn by `LearnShellSkeleton`.
 */
export function LessonPlayerSkeletonBody() {
  return (
    <div className="flex min-h-full flex-col" aria-hidden>
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex w-full max-w-[880px] flex-col gap-6xl px-4 pb-7xl pt-6xl sm:px-6 md:px-8xl">
        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-3 h-8 w-3/4 max-w-xl rounded-lg" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full Learn screen, mirroring `Learn.tsx`: shared `AppHeaderBar` header, the lesson column with the floating
 * action bar (and the curriculum edge tab below 1280px) and, from 1280px, the curriculum panel
 * at its default 28% share.
 */
export function LearnShellSkeleton({ className, immediate }: { className?: string; immediate?: boolean }) {
  return (
    <LoadingStatus className={cn("flex h-full flex-col bg-background", className)} immediate={immediate}>
      <AppHeaderBar aria-hidden>
        <Skeleton className="h-9 w-[108px] rounded-md" />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-[15px] xl:absolute xl:left-1/2 xl:max-w-[50%] xl:flex-none xl:-translate-x-1/2">
          <Skeleton className="hidden h-5 w-40 sm:block" />
          <span className="hidden w-px shrink-0 self-stretch bg-border sm:block" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md max-sm:size-8" />
      </AppHeaderBar>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative min-w-0 flex-[72_1_0%] overflow-hidden">
          <LessonPlayerSkeletonBody />
          <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex justify-center px-3" aria-hidden>
            <div className="flex items-center gap-md rounded-xl border border-border-strong bg-surface-float/95 p-1.5">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
              <Skeleton className="h-8 w-40 rounded-md" />
            </div>
          </div>
          <Skeleton className="absolute right-0 top-5 z-10 h-10 w-10 rounded-l-lg rounded-r-none xl:hidden" aria-hidden />
        </div>
        <div className="hidden min-h-0 flex-[28_1_0%] flex-col overflow-hidden border-l border-border bg-surface-base xl:flex" aria-hidden>
          <div className="flex items-center gap-xl border-b border-border bg-sidebar px-xl py-xl xl:px-4xl">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="mx-auto h-5 w-28" />
            <Skeleton className="size-6 rounded-md" />
          </div>
          <div className="flex flex-col gap-2xl pb-2xl">
            {[3, 2, 2].map((lessons, section) => (
              <div key={section} className="flex flex-col gap-md">
                <div className="border-y border-border px-lg">
                  <div className="flex items-center gap-lg border border-transparent px-lg py-2md">
                    <Skeleton className="h-[22px] flex-1" />
                    <Skeleton className="size-4" />
                  </div>
                </div>
                <div className="flex flex-col px-2xl">
                  {Array.from({ length: lessons }, (_, row) => (
                    <div key={row} className="flex items-center gap-lg border border-transparent px-2md py-2md">
                      <Skeleton className="size-5 shrink-0 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                  ))}
                </div>
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
