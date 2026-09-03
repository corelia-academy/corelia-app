import { describe, expect, it } from "vitest";

import { finiteNumber, htmlToText, normalizeUrl, slugify, stableStringify } from "./normalization.ts";

describe("jobs normalization", () => {
  it("removes executable markup and tracking parameters", () => {
    expect(htmlToText("<p>Hello &amp; welcome</p><script>alert(1)</script><p>Next</p>"))
      .toBe("Hello & welcome\nNext");
    expect(normalizeUrl("https://Example.com/jobs/1/?utm_source=x&team=core#apply"))
      .toBe("https://example.com/jobs/1?team=core");
    expect(normalizeUrl("javascript:alert(1)")).toBe("");
    expect(normalizeUrl("/relative/jobs/1")).toBe("");
  });

  it("produces stable hashes inputs independent of object key order", () => {
    expect(stableStringify({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(stableStringify({ a: { c: 3, d: 4 }, b: 2 }));
    expect(slugify("Kỹ sư Backend — Việt Nam")).toBe("ky-su-backend-viet-nam");
  });

  it("does not turn missing salary values into zero", () => {
    expect(finiteNumber(null)).toBeNull();
    expect(finiteNumber("")).toBeNull();
    expect(finiteNumber("125000")).toBe(125000);
  });
});
