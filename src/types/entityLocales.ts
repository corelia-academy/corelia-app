import type { Locale } from "@/types/database";

/**
 * Minimal i18n config for text-only entities (hackathons, career tracks, projects).
 * Unlike courses, there are no video-related locale settings.
 */
export type EntityI18nConfig = {
  supported_locales?: Locale[];
  primary_content_locale?: Locale;
};

