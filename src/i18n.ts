import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import common_vi from "@/locales/vi/common.json";
import auth_vi from "@/locales/vi/auth.json";
import courses_vi from "@/locales/vi/courses.json";
import contests_vi from "@/locales/vi/contests.json";
import account_vi from "@/locales/vi/account.json";
import instructor_vi from "@/locales/vi/instructor.json";
import admin_vi from "@/locales/vi/admin.json";
import career_vi from "@/locales/vi/career.json";
import feed_vi from "@/locales/vi/feed.json";
import jobs_vi from "@/locales/vi/jobs.json";

import common_en from "@/locales/en/common.json";
import auth_en from "@/locales/en/auth.json";
import courses_en from "@/locales/en/courses.json";
import contests_en from "@/locales/en/contests.json";
import account_en from "@/locales/en/account.json";
import instructor_en from "@/locales/en/instructor.json";
import admin_en from "@/locales/en/admin.json";
import career_en from "@/locales/en/career.json";
import feed_en from "@/locales/en/feed.json";
import jobs_en from "@/locales/en/jobs.json";

export const SUPPORTED_LANGUAGES = ["vi", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "vi";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: [...SUPPORTED_LANGUAGES],
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: "common",
    ns: [
      "common",
      "auth",
      "courses",
      "career",
      "contests",
      "account",
      "instructor",
      "admin",
      "feed",
      "jobs",
    ],
    resources: {
      vi: {
        common: common_vi,
        auth: auth_vi,
        courses: courses_vi,
        career: career_vi,
        contests: contests_vi,
        account: account_vi,
        instructor: instructor_vi,
        admin: admin_vi,
        feed: feed_vi,
        jobs: jobs_vi,
      },
      en: {
        common: common_en,
        auth: auth_en,
        courses: courses_en,
        career: career_en,
        contests: contests_en,
        account: account_en,
        instructor: instructor_en,
        admin: admin_en,
        feed: feed_en,
        jobs: jobs_en,
      },
    },
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
    react: {
      useSuspense: false,
    },
    returnEmptyString: false,
    returnNull: false,
  });

export default i18n;
