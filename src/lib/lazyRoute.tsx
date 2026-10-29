import { lazy, useState, type ComponentType } from "react";

type RouteModule = { default: ComponentType };

/** A route chunk that remembers its loaded module, so preloading and rendering share one import. */
export type RouteChunk = {
  load: () => Promise<RouteModule>;
  loaded: () => RouteModule | undefined;
};

export function routeChunk(factory: () => Promise<RouteModule>): RouteChunk {
  let promise: Promise<RouteModule> | undefined;
  let module: RouteModule | undefined;
  return {
    load: () =>
      (promise ??= factory().then(
        (loaded) => (module = loaded),
        (error: unknown) => {
          promise = undefined;
          throw error;
        },
      )),
    loaded: () => module,
  };
}

/**
 * `lazy()` for a route chunk that renders synchronously once the chunk has loaded (preloaded during
 * auth boot or prefetched on hover). Plain `lazy` suspends at least once even then, and after its
 * fallback commits React holds the real content back for ~300ms.
 */
export function lazyRoute(chunk: RouteChunk): ComponentType {
  const Lazy = lazy(chunk.load);
  return function LazyRoute() {
    // Chosen once per mount so the subtree never switches component type (which would remount it).
    const [Component] = useState<ComponentType>(() => chunk.loaded()?.default ?? Lazy);
    return <Component />;
  };
}
