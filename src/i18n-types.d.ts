import "i18next";

import common from "@/locales/vi/common.json";
import auth from "@/locales/vi/auth.json";
import courses from "@/locales/vi/courses.json";
import contests from "@/locales/vi/contests.json";
import cohorts from "@/locales/vi/cohorts.json";
import account from "@/locales/vi/account.json";
import instructor from "@/locales/vi/instructor.json";
import admin from "@/locales/vi/admin.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      auth: typeof auth;
      courses: typeof courses;
      contests: typeof contests;
      cohorts: typeof cohorts;
      account: typeof account;
      instructor: typeof instructor;
      admin: typeof admin;
    };
  }
}

