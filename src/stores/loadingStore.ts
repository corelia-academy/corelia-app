import { create } from "zustand";

interface LoadingStore {
  activeKeys: Set<string>;
  isLoading: boolean;
  startLoading: (key: string) => void;
  stopLoading: (key: string) => void;
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  activeKeys: new Set<string>(),
  isLoading: false,
  startLoading: (key) =>
    set((state) => {
      const nextKeys = new Set(state.activeKeys);
      nextKeys.add(key);
      return {
        activeKeys: nextKeys,
        isLoading: nextKeys.size > 0,
      };
    }),
  stopLoading: (key) =>
    set((state) => {
      const nextKeys = new Set(state.activeKeys);
      nextKeys.delete(key);
      return {
        activeKeys: nextKeys,
        isLoading: nextKeys.size > 0,
      };
    }),
}));

export function trackLoadingPromise<T>(promise: Promise<T>, key?: string): Promise<T> {
  const finalKey = key || `promise-${Math.random().toString(36).substring(2, 9)}`;
  const startLoading = useLoadingStore.getState().startLoading;
  const stopLoading = useLoadingStore.getState().stopLoading;

  startLoading(finalKey);
  return promise.finally(() => {
    stopLoading(finalKey);
  });
}
