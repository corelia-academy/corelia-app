import type { SupportedLanguage } from "@/i18n";

let currentRevision = 0;
let activeTargetLocale: SupportedLanguage | null = null;
const inFlightRevisions = new Set<number>();

/**
 * Starts a user-initiated language change and returns the monotonic revision ID.
 */
export function startManualLocaleChange(targetLocale: SupportedLanguage): number {
  const revision = ++currentRevision;
  activeTargetLocale = targetLocale;
  inFlightRevisions.add(revision);
  return revision;
}

/**
 * Backward-compatible alias for startManualLocaleChange.
 */
export function recordManualLocaleChange(lng: SupportedLanguage): number {
  return startManualLocaleChange(lng);
}

/**
 * Confirms that a specific revision has successfully persisted.
 */
export function confirmManualLocaleSuccess(revision: number, locale: SupportedLanguage): void {
  inFlightRevisions.delete(revision);
  if (revision === currentRevision) {
    activeTargetLocale = locale;
  }
}

/**
 * Rolls back manual intent if this revision is still the latest user action.
 * Returns true if rollback should be applied to UI/cache.
 */
export function rollbackManualLocaleChange(
  revision: number,
  previousLocale: SupportedLanguage,
): boolean {
  inFlightRevisions.delete(revision);
  if (revision === currentRevision) {
    activeTargetLocale = previousLocale;
    return true;
  }
  return false;
}

/**
 * Determines whether AuthSync should ignore an incoming locale from a stale profile fetch.
 * Returns true if incomingLocale contradicts the active user intent.
 */
export function isAuthSyncLocaleIgnored(
  incomingLocale: string | null | undefined,
): boolean {
  if (!incomingLocale) return true;
  if (!activeTargetLocale) return false;

  // If there's an active target (either in-flight or explicitly chosen)
  // that differs from incoming background locale, ignore the background fetch.
  return incomingLocale !== activeTargetLocale;
}

/**
 * Resets the manual locale intent and in-flight revisions (e.g. on user sign out or switch).
 */
export function resetManualLocaleIntent(): void {
  currentRevision = 0;
  activeTargetLocale = null;
  inFlightRevisions.clear();
}

export function resetManualLocaleGuard(): void {
  resetManualLocaleIntent();
}
