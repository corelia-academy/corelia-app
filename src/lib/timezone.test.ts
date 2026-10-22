import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AUTO_TIMEZONE,
  detectTimeZone,
  getTimeZonePreference,
  installTimeZonePreference,
  listTimeZones,
  parseTimeZonePreference,
  resolvedTimeZone,
  setTimeZonePreference,
  subscribeTimeZonePreference,
} from "./timezone";

const store = new Map<string, string>();
const instant = new Date("2026-01-01T00:30:00Z");

beforeAll(() => {
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  } as Storage;
  installTimeZonePreference();
});

afterEach(() => setTimeZonePreference(AUTO_TIMEZONE));

describe("timezone preference", () => {
  it("defaults to auto-detect", () => {
    expect(getTimeZonePreference()).toBe(AUTO_TIMEZONE);
    expect(resolvedTimeZone()).toBe(detectTimeZone());
  });

  it("falls back to auto for unknown zones", () => {
    expect(parseTimeZonePreference("Mars/Olympus")).toBe(AUTO_TIMEZONE);
    expect(parseTimeZonePreference(null)).toBe(AUTO_TIMEZONE);
    expect(parseTimeZonePreference("Asia/Tokyo")).toBe("Asia/Tokyo");
  });

  it("persists the choice and clears it again for auto", () => {
    setTimeZonePreference("Asia/Tokyo");
    expect(store.get("corelia.timezone")).toBe("Asia/Tokyo");
    setTimeZonePreference(AUTO_TIMEZONE);
    expect(store.has("corelia.timezone")).toBe(false);
  });

  it("applies the chosen zone to formatting without an explicit timeZone", () => {
    setTimeZonePreference("Asia/Tokyo");
    expect(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23" }).format(instant)).toBe("09");
    expect(instant.toLocaleTimeString("en-US", { hour: "numeric", hourCycle: "h23" })).toBe("09");
    expect(instant.toLocaleDateString("en-US")).toBe("1/1/2026");
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Tokyo");

    setTimeZonePreference("America/New_York");
    expect(instant.toLocaleDateString("en-US")).toBe("12/31/2025");
  });

  it("keeps an explicitly pinned timeZone", () => {
    setTimeZonePreference("Asia/Tokyo");
    expect(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "UTC" }).format(instant)).toBe("00");
  });

  it("notifies subscribers on change", () => {
    let calls = 0;
    const unsubscribe = subscribeTimeZonePreference(() => calls++);
    setTimeZonePreference("Europe/Paris");
    setTimeZonePreference("Europe/Paris");
    unsubscribe();
    expect(calls).toBe(1);
  });

  it("lists IANA zones including the detected one", () => {
    expect(listTimeZones()).toContain(detectTimeZone());
  });
});
