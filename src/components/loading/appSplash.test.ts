// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

async function setup() {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="app-splash"></div>';
  return import("./appSplash");
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("app splash", () => {
  it("stays while a loading screen holds it and fades out after the last release", async () => {
    const { hasAppSplash, holdAppSplash, scheduleAppSplashRelease } = await setup();
    scheduleAppSplashRelease(500);
    const releaseBoot = holdAppSplash();
    vi.advanceTimersByTime(600);
    expect(hasAppSplash()).toBe(true);

    // Boot screen hands over to a route fallback in the same commit.
    releaseBoot();
    const releaseFallback = holdAppSplash();
    vi.advanceTimersByTime(100);
    expect(hasAppSplash()).toBe(true);

    releaseFallback();
    vi.advanceTimersByTime(60);
    expect(document.getElementById("app-splash")?.hasAttribute("data-hidden")).toBe(true);
    expect(hasAppSplash()).toBe(false);
    vi.advanceTimersByTime(400);
    expect(document.getElementById("app-splash")).toBeNull();
  });

  it("hides on its own when nothing ever holds it", async () => {
    const { hasAppSplash, scheduleAppSplashRelease } = await setup();
    scheduleAppSplashRelease(500);
    vi.advanceTimersByTime(499);
    expect(hasAppSplash()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hasAppSplash()).toBe(false);
  });

  it("stays up across an initial-load redirect until the new location commits", async () => {
    const { hasAppSplash, holdAppSplash, holdAppSplashForNavigation, releaseAppSplashNavigationHold } = await setup();
    const releaseLogin = holdAppSplash();
    // /login decides to redirect: the router takes a hold, then the login screen unmounts.
    holdAppSplashForNavigation();
    releaseLogin();
    vi.advanceTimersByTime(500);
    expect(hasAppSplash()).toBe(true);

    releaseAppSplashNavigationHold();
    vi.advanceTimersByTime(60);
    expect(hasAppSplash()).toBe(false);
  });

  it("does not take a navigation hold once the splash is gone", async () => {
    const { hasAppSplash, holdAppSplashForNavigation, scheduleAppSplashRelease } = await setup();
    scheduleAppSplashRelease(0);
    vi.advanceTimersByTime(1);
    expect(hasAppSplash()).toBe(false);
    holdAppSplashForNavigation();
    expect(hasAppSplash()).toBe(false);
  });
});
