import { describe, expect, it, vi } from "vitest";
import {
  installStaleChunkRecovery,
  isStaleChunkLoadError,
  STALE_CHUNK_RELOAD_COOLDOWN_MS,
  STALE_CHUNK_RELOAD_KEY,
} from "@/lib/staleChunkRecovery";

function preloadError(message: string): VitePreloadErrorEvent {
  const event = new Event("vite:preloadError", { cancelable: true }) as VitePreloadErrorEvent;
  Object.defineProperty(event, "payload", {
    value: new TypeError(message),
  });
  return event;
}

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe("installStaleChunkRecovery", () => {
  it("prevents the first preload error, records it, and reloads the current page", () => {
    const eventTarget = new EventTarget();
    const storage = memoryStorage();
    const reload = vi.fn();
    const logger = { warn: vi.fn() };
    const cleanup = installStaleChunkRecovery({
      buildVersion: "0.8.1",
      eventTarget,
      storage,
      reload,
      now: () => 120_000,
      logger,
    });
    const event = preloadError(
      "Failed to fetch dynamically imported module: https://app.corelia.academy/assets/index-old.js?token=hidden",
    );

    eventTarget.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(STALE_CHUNK_RELOAD_KEY, "120000");
    expect(reload).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event: "vite_preload_error",
        buildVersion: "0.8.1",
        chunkPath: "/assets/index-old.js",
      }),
    );
    cleanup();
  });

  it("does not reload again during the cooldown, then recovers after it expires", () => {
    const eventTarget = new EventTarget();
    const storage = memoryStorage();
    const reload = vi.fn();
    let currentTime = 100_000;
    installStaleChunkRecovery({
      buildVersion: "0.8.1",
      eventTarget,
      storage,
      reload,
      now: () => currentTime,
      logger: { warn: vi.fn() },
    });

    eventTarget.dispatchEvent(preloadError("Failed to fetch dynamically imported module"));
    currentTime += STALE_CHUNK_RELOAD_COOLDOWN_MS - 1;
    const blockedEvent = preloadError("Failed to fetch dynamically imported module");
    eventTarget.dispatchEvent(blockedEvent);

    expect(blockedEvent.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledOnce();

    currentTime += 1;
    const recoveredEvent = preloadError("Failed to fetch dynamically imported module");
    eventTarget.dispatchEvent(recoveredEvent);

    expect(recoveredEvent.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("replaces an invalid or future reload marker", () => {
    for (const marker of ["invalid", "999999"]) {
      const eventTarget = new EventTarget();
      const storage = memoryStorage({ [STALE_CHUNK_RELOAD_KEY]: marker });
      const reload = vi.fn();
      installStaleChunkRecovery({
        buildVersion: "0.8.1",
        eventTarget,
        storage,
        reload,
        now: () => 100_000,
        logger: { warn: vi.fn() },
      });

      eventTarget.dispatchEvent(preloadError("Importing a module script failed"));

      expect(storage.setItem).toHaveBeenCalledWith(STALE_CHUNK_RELOAD_KEY, "100000");
      expect(reload).toHaveBeenCalledOnce();
    }
  });

  it("leaves the error unhandled when session storage is unavailable", () => {
    const eventTarget = new EventTarget();
    const reload = vi.fn();
    const event = preloadError("Failed to fetch dynamically imported module");
    installStaleChunkRecovery({
      buildVersion: "0.8.1",
      eventTarget,
      storage: {
        getItem: vi.fn(() => {
          throw new Error("storage disabled");
        }),
        setItem: vi.fn(),
      },
      reload,
      now: () => 100_000,
      logger: { warn: vi.fn() },
    });

    eventTarget.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("isStaleChunkLoadError", () => {
  it.each([
    "Failed to fetch dynamically imported module",
    "Error loading dynamically imported module",
    "Importing a module script failed",
    "Loading chunk 42 failed",
    "ChunkLoadError",
    "Unable to preload CSS",
  ])("recognizes %s", (message) => {
    expect(isStaleChunkLoadError(new Error(message))).toBe(true);
  });

  it("does not classify unrelated application errors as stale chunks", () => {
    expect(isStaleChunkLoadError(new Error("Profile request failed"))).toBe(false);
  });
});
