/** True when this document was loaded via a full browser reload (refresh). */
export function isNavigationReload(): boolean {
  if (typeof performance === "undefined") return false;
  const entry = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === "reload";
}
