let hasClientNavigated = false;

/** Called by the router on its first in-app navigation (see `ApplicationRouter`). */
export function markClientNavigation() {
  hasClientNavigated = true;
}

/** True until the first user navigation: route fallbacks show the global loading screen. */
export function isInitialLoad(): boolean {
  return !hasClientNavigated;
}

/**
 * Class that hides a loading placeholder for its first 200ms, so fast loads finish without a
 * skeleton flash. Only after an in-app navigation: on first paint the placeholder must show at
 * once, or it would blink between the bootstrap skeleton and the page.
 */
export function skeletonRevealClass(immediate = false): string | undefined {
  return !immediate && hasClientNavigated ? "animate-skeleton-reveal" : undefined;
}
