import { describe, expect, it } from "vitest";
import { SITE_LOCALES } from "@corelia/ui/locales";

import { CONTENT_LOCALES } from "@/lib/locales";

describe("landing and app locales", () => {
  it("offer the same languages so the shared header and language menu agree", () => {
    expect([...SITE_LOCALES].sort()).toEqual([...CONTENT_LOCALES].sort());
  });
});
