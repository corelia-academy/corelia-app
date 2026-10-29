import i18n, { type BackendModule, type ResourceKey } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { CONTENT_LOCALES, LOCALE_PREFERENCE_COOKIE, parseContentLocale, type ContentLocale } from "@/lib/locales";

import common_vi from "@/locales/vi/common.json";
import auth_vi from "@/locales/vi/auth.json";
import courses_vi from "@/locales/vi/courses.json";
import contests_vi from "@/locales/vi/contests.json";
import account_vi from "@/locales/vi/account.json";
import instructor_vi from "@/locales/vi/instructor.json";
import admin_vi from "@/locales/vi/admin.json";
import feed_vi from "@/locales/vi/feed.json";
import jobs_vi from "@/locales/vi/jobs.json";
import emailCenter_vi from "@/locales/vi/emailCenter.json";

import common_en from "@/locales/en/common.json";
import auth_en from "@/locales/en/auth.json";
import courses_en from "@/locales/en/courses.json";
import contests_en from "@/locales/en/contests.json";
import account_en from "@/locales/en/account.json";
import instructor_en from "@/locales/en/instructor.json";
import admin_en from "@/locales/en/admin.json";
import feed_en from "@/locales/en/feed.json";
import jobs_en from "@/locales/en/jobs.json";
import emailCenter_en from "@/locales/en/emailCenter.json";

export const SUPPORTED_LANGUAGES = CONTENT_LOCALES;
export type SupportedLanguage = ContentLocale;

export const DEFAULT_LANGUAGE: SupportedLanguage = "vi";

// vi and en ship in the main bundle; every other language loads on demand.
const lazyBundles = import.meta.glob<ResourceKey>(
  ["./locales/*/*.json", "!./locales/vi/*.json", "!./locales/en/*.json"],
  { import: "default" },
);

const lazyBackend: BackendModule = {
  type: "backend",
  init() {},
  read(language, namespace, callback) {
    const load = lazyBundles[`./locales/${language}/${namespace}.json`];
    if (!load) {
      callback(null, {});
      return;
    }
    load().then(
      (data) => callback(null, data),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), null),
    );
  },
};

void i18n
  .use(lazyBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: [...SUPPORTED_LANGUAGES],
    // Keep regional tags intact so zh-CN and zh-TW never collapse into "zh".
    load: "currentOnly",
    partialBundledLanguages: true,
    fallbackLng: { "zh-TW": ["zh-CN", "en"], default: ["en", DEFAULT_LANGUAGE] },
    defaultNS: "common",
    ns: [
      "common",
      "auth",
      "courses",
      "contests",
      "account",
      "instructor",
      "admin",
      "feed",
      "jobs",
      "emailCenter",
    ],
    resources: {
      vi: {
        common: common_vi,
        auth: auth_vi,
        courses: courses_vi,
        contests: contests_vi,
        account: account_vi,
        instructor: instructor_vi,
        admin: admin_vi,
        feed: feed_vi,
        jobs: jobs_vi,
        emailCenter: emailCenter_vi,
      },
      en: {
        common: common_en,
        auth: auth_en,
        courses: courses_en,
        contests: contests_en,
        account: account_en,
        instructor: instructor_en,
        admin: admin_en,
        feed: feed_en,
        jobs: jobs_en,
        emailCenter: emailCenter_en,
      },
    },
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // The cookie carries an explicit choice made on the landing site (same domain).
      order: ["localStorage", "cookie", "navigator", "htmlTag"],
      lookupLocalStorage: "i18nextLng",
      lookupCookie: LOCALE_PREFERENCE_COOKIE,
      caches: ["localStorage"],
      convertDetectedLanguage: (lng: string) => parseContentLocale(lng) ?? lng,
    },
    react: {
      useSuspense: false,
    },
    returnEmptyString: false,
    returnNull: false,
  });

export default i18n;
