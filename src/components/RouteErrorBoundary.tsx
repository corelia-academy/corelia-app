import { useEffect } from "react";
import { useRouteError } from "react-router";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { isStaleChunkLoadError, reloadOnceForStaleChunk } from "@/lib/staleChunkRecovery";

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (value && typeof value === "object" && "statusText" in value) {
    return new Error(String((value as { statusText?: unknown }).statusText || "Unexpected error"));
  }
  return new Error(typeof value === "string" ? value : "Unexpected error");
}

/**
 * Router `errorElement`: replaces React Router's default "Hey developer" screen.
 * A stale-chunk failure (old tab after a deploy) reloads once automatically; otherwise the
 * shared fallback offers retry/home.
 */
export function RouteErrorBoundary() {
  const error = toError(useRouteError());

  useEffect(() => {
    console.error("[RouteErrorBoundary]", error);
    if (isStaleChunkLoadError(error)) reloadOnceForStaleChunk();
  }, [error]);

  return (
    <ErrorFallback
      error={error}
      onRetry={() => {
        if (isStaleChunkLoadError(error)) window.location.reload();
        else window.location.assign(window.location.pathname + window.location.search);
      }}
    />
  );
}
