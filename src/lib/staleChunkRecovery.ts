const STALE_CHUNK_ERROR_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk \d+ failed|chunkloaderror|unable to preload css/i;

export const STALE_CHUNK_RELOAD_KEY = "corelia:stale-chunk-reload-at";
export const STALE_CHUNK_RELOAD_COOLDOWN_MS = 60_000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

type PreloadErrorTarget = {
  addEventListener(type: "vite:preloadError", listener: EventListener): void;
  removeEventListener(type: "vite:preloadError", listener: EventListener): void;
};

type RecoveryOptions = {
  buildVersion: string;
  eventTarget?: PreloadErrorTarget;
  storage?: StorageLike;
  reload?: () => void;
  now?: () => number;
  logger?: Pick<Console, "warn">;
};

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  return String(error);
}

function chunkPathFromError(error: unknown): string | undefined {
  const match = errorText(error).match(/https?:\/\/[^\s)]+/i);
  if (!match) return undefined;

  try {
    return new URL(match[0]).pathname;
  } catch {
    return undefined;
  }
}

export function isStaleChunkLoadError(error: unknown): boolean {
  return STALE_CHUNK_ERROR_PATTERN.test(errorText(error));
}

export function installStaleChunkRecovery({
  buildVersion,
  eventTarget = window,
  storage = window.sessionStorage,
  reload = () => window.location.reload(),
  now = Date.now,
  logger = console,
}: RecoveryOptions): () => void {
  const handlePreloadError: EventListener = (rawEvent) => {
    const event = rawEvent as VitePreloadErrorEvent;
    const currentTime = now();
    let lastReloadAt: number;

    try {
      const storedReloadAt = storage.getItem(STALE_CHUNK_RELOAD_KEY);
      lastReloadAt = storedReloadAt === null ? Number.NaN : Number(storedReloadAt);
      const elapsed = currentTime - lastReloadAt;
      if (Number.isFinite(lastReloadAt) && elapsed >= 0 && elapsed < STALE_CHUNK_RELOAD_COOLDOWN_MS) {
        return;
      }
      storage.setItem(STALE_CHUNK_RELOAD_KEY, String(currentTime));
    } catch {
      // Without a persistent per-tab guard, reloading could create an infinite loop.
      return;
    }

    event.preventDefault();
    logger.warn("[stale-chunk-recovery] Reloading after a Vite preload error", {
      event: "vite_preload_error",
      buildVersion,
      chunkPath: chunkPathFromError(event.payload),
    });
    reload();
  };

  eventTarget.addEventListener("vite:preloadError", handlePreloadError);
  return () => eventTarget.removeEventListener("vite:preloadError", handlePreloadError);
}
