import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Loại bỏ các trường có giá trị undefined trước khi ghi lên Firestore. */
export function removeUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as T;
}

/**
 * Tạo một Map cache có TTL (time-to-live).
 * API giống Map thông thường (get/set/delete/keys/clear) nhưng tự expire entry cũ.
 */
export function makeTTLCache<T>(ttlMs: number) {
  type Entry = { promise: Promise<T>; ts: number };
  const store = new Map<string, Entry>();
  return {
    get(key: string): Promise<T> | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.ts > ttlMs) {
        store.delete(key);
        return undefined;
      }
      return entry.promise;
    },
    set(key: string, promise: Promise<T>): void {
      store.set(key, { promise, ts: Date.now() });
    },
    delete(key: string): void {
      store.delete(key);
    },
    keys(): IterableIterator<string> {
      return store.keys();
    },
    clear(): void {
      store.clear();
    },
  };
}
