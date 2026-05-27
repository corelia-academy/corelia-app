import "i18next";

import common from "@/locales/vi/common.json";
import auth from "@/locales/vi/auth.json";
import courses from "@/locales/vi/courses.json";
import contests from "@/locales/vi/contests.json";
import account from "@/locales/vi/account.json";
import instructor from "@/locales/vi/instructor.json";
import admin from "@/locales/vi/admin.json";
import career from "@/locales/vi/career.json";
import learningPath from "@/locales/vi/learningPath.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      auth: typeof auth;
      courses: typeof courses;
      career: typeof career;
      learningPath: typeof learningPath;
      contests: typeof contests;
      account: typeof account;
      instructor: typeof instructor;
      admin: typeof admin;
    };
  }
}

