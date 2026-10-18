import { describe, expect, it, vi } from "vitest";

async function load(base: string) {
  vi.resetModules();
  vi.stubEnv("BASE_URL", base);
  return import("./appUrl");
}

describe("appUrl helpers", () => {
  it("prefixes paths and URLs with the /learn base", async () => {
    const { APP_BASE_PATH, appPath, appUrl } = await load("/learn/");
    expect(APP_BASE_PATH).toBe("/learn");
    expect(appPath("/courses/x")).toBe("/learn/courses/x");
    expect(appPath("logo/a.svg")).toBe("/learn/logo/a.svg");
    expect(appUrl("/verify/A1", "https://corelia.academy")).toBe("https://corelia.academy/learn/verify/A1");
  });

  it("strips the base path for router matching", async () => {
    const { stripAppBasePath } = await load("/learn/");
    expect(stripAppBasePath("/learn")).toBe("/");
    expect(stripAppBasePath("/learn/study/x")).toBe("/study/x");
    expect(stripAppBasePath("/learning")).toBe("/learning");
  });

  it("is a no-op when served at the root", async () => {
    const { appPath, stripAppBasePath } = await load("/");
    expect(appPath("/feed")).toBe("/feed");
    expect(stripAppBasePath("/feed")).toBe("/feed");
  });
});
