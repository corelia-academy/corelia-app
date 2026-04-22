import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import common_vi from "@/locales/vi/common.json";
import auth_vi from "@/locales/vi/auth.json";
import courses_vi from "@/locales/vi/courses.json";
import contests_vi from "@/locales/vi/contests.json";
import cohorts_vi from "@/locales/vi/cohorts.json";
import account_vi from "@/locales/vi/account.json";
import instructor_vi from "@/locales/vi/instructor.json";
import admin_vi from "@/locales/vi/admin.json";

import common_en from "@/locales/en/common.json";
import auth_en from "@/locales/en/auth.json";
import courses_en from "@/locales/en/courses.json";
import contests_en from "@/locales/en/contests.json";
import cohorts_en from "@/locales/en/cohorts.json";
import account_en from "@/locales/en/account.json";
import instructor_en from "@/locales/en/instructor.json";
import admin_en from "@/locales/en/admin.json";

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
      "contests",
      "cohorts",
      "account",
      "instructor",
      "admin",
    ],
    resources: {
      vi: {
        common: common_vi,
        auth: auth_vi,
        courses: courses_vi,
        contests: contests_vi,
        cohorts: cohorts_vi,
        account: account_vi,
        instructor: instructor_vi,
        admin: admin_vi,
      },
      en: {
        common: common_en,
        auth: auth_en,
        courses: courses_en,
        contests: contests_en,
        cohorts: cohorts_en,
        account: account_en,
        instructor: instructor_en,
        admin: admin_en,
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

