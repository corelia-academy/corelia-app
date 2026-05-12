/** Client-side fetch timing helpers (staging/local debugging). Disabled in production builds unless perf debug is explicitly enabled. */

const PERF_DEBUG =
  import.meta.env.DEV || import.meta.env.VITE_PERF_DEBUG === "true";

const prefix = "[perf]";

/** Mark start of an async stretch; pair with perfMeasureEnd same label. */
export function perfMeasureStart(label: string): void {
  if (!PERF_DEBUG) return;
  try {
    performance.mark(`${label}:start`);
  } catch {
    // ignore
  }
}

export function perfMeasureEnd(label: string, detail?: Record<string, unknown>): void {
  if (!PERF_DEBUG) return;
  const durationMs = (() => {
    try {
      performance.mark(`${label}:end`);
      const measure = performance.measure(label, `${label}:start`, `${label}:end`);
      return Number(measure.duration.toFixed(1));
    } catch {
      return undefined;
    }
  })();
  if (detail && durationMs !== undefined) {
    console.info(prefix, label, `${durationMs}ms`, detail);
  } else if (durationMs !== undefined) {
    console.info(prefix, label, `${durationMs}ms`);
  }
}

/** Wrap Promise with duration logging in perf-debug mode only. */
export async function timedAsync<T>(
  label: string,
  fn: () => Promise<T>,
  detail?: Record<string, unknown>,
): Promise<T> {
  if (!PERF_DEBUG) return fn();

  perfMeasureStart(label);
  try {
    return await fn();
  } finally {
    perfMeasureEnd(label, detail);
  }
}

export function timedAsyncVoid(
  label: string,
  fn: () => Promise<void>,
  detail?: Record<string, unknown>,
): void {
  if (!PERF_DEBUG) {
    void fn();
    return;
  }
  void timedAsync(label, fn, detail);
}
