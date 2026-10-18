import { describe, expect, it, vi } from "vitest";

import { contentLocales, pickContentLocale } from "./catalog";
import { catalogNotFound, formatSalary, routeLocale, validSlug } from "./catalogRoute";
import { alternates, jsonLd, paragraphs, truncate } from "./seo";

describe("catalog locales", () => {
  it("defaults content to Vietnamese like the app and keeps the primary locale first", () => {
    expect(contentLocales(null)).toEqual(["vi"]);
    expect(contentLocales({ primary_content_locale: "en", supported_locales: ["vi", "zh_TW", "fr"] })).toEqual(["en", "vi", "zh-TW"]);
  });

  it("shows a translation when it exists and the primary language otherwise", () => {
    const config = { primary_content_locale: "vi", supported_locales: ["vi", "en"] };
    expect(pickContentLocale(config, "en")).toBe("en");
    expect(pickContentLocale(config, "ja")).toBe("vi");
  });
});

describe("catalog routes", () => {
  it.each([
    [undefined, "en"], ["vi", "vi"], ["zh-cn", "zh-CN"], ["ZH-TW", "zh-TW"], ["en", null], ["blog", null],
  ] as const)("maps the locale segment %s", (segment, expected) => {
    expect(routeLocale(segment)).toBe(expected);
  });

  it("accepts database slugs and rejects anything that could reshape the query", () => {
    expect(validSlug("solana-basics")).toBe(true);
    expect(validSlug("khoá-học-1")).toBe(true);
    expect(validSlug("a,b")).toBe(false);
    expect(validSlug("in.(1,2)")).toBe(false);
    expect(validSlug("")).toBe(false);
    expect(validSlug(undefined)).toBe(false);
  });

  it("formats salaries and tolerates unknown currencies", () => {
    expect(formatSalary({ salaryMin: 2000, salaryMax: 4000, salaryCurrency: "USD" }, "en")).toBe("$2,000 – $4,000");
    expect(formatSalary({ salaryMin: null, salaryMax: null, salaryCurrency: "USD" }, "en")).toBe("");
    expect(formatSalary({ salaryMin: 5, salaryMax: null, salaryCurrency: "NOPE1" }, "en")).toBe("5 NOPE1");
  });

  it("serves the static 404 page with a 404 status", async () => {
    const fetch = vi.fn(async () => new Response("<h1>404</h1>", { status: 200 }));
    const response = await catalogNotFound(new Request("https://corelia.academy/courses/x"), { runtime: { env: { ASSETS: { fetch } } } });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("<h1>404</h1>");
    expect((fetch.mock.calls[0] as unknown as [URL])[0].toString()).toBe("https://corelia.academy/404");
    expect((await catalogNotFound(new Request("https://corelia.academy/x"), {})).status).toBe(404);
  });
});

describe("seo helpers", () => {
  it("builds hreflang alternates with an English x-default when available", () => {
    expect(alternates("/courses/x", ["vi", "en"])).toEqual([
      { hreflang: "vi", href: "https://corelia.academy/vi/courses/x" },
      { hreflang: "en", href: "https://corelia.academy/courses/x" },
      { hreflang: "x-default", href: "https://corelia.academy/courses/x" },
    ]);
    expect(alternates("/hackathons/h", ["vi"]).at(-1)).toEqual({ hreflang: "x-default", href: "https://corelia.academy/vi/hackathons/h" });
  });

  it("escapes JSON-LD so it cannot close the script tag", () => {
    expect(jsonLd({ name: "</script><b>" })).toBe('{"name":"\\u003c/script>\\u003cb>"}');
  });

  it("turns Markdown-ish text into plain paragraphs and short descriptions", () => {
    expect(paragraphs("## Intro\n\nLearn **Rust** [here](https://x).\n\n\nDone")).toEqual(["Intro", "Learn Rust here.", "Done"]);
    expect(truncate("a ".repeat(200), 10)).toBe("a a a a a…");
  });
});
