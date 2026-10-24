// @vitest-environment happy-dom
import { Suspense, act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { lazyRoute, routeChunk } from "./lazyRoute";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement("div");
let root = createRoot(host);
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
});

const Page = () => <p>page</p>;

it("renders a preloaded chunk without suspending", async () => {
  const chunk = routeChunk(async () => ({ default: Page }));
  await chunk.load();
  const Route = lazyRoute(chunk);
  act(() => root.render(<Suspense fallback={<p>fallback</p>}><Route /></Suspense>));
  expect(host.textContent).toBe("page");
});

it("suspends until a chunk that was not preloaded loads, sharing one import", async () => {
  let calls = 0;
  const chunk = routeChunk(async () => {
    calls += 1;
    return { default: Page };
  });
  const Route = lazyRoute(chunk);
  act(() => root.render(<Suspense fallback={<p>fallback</p>}><Route /></Suspense>));
  expect(host.textContent).toBe("fallback");
  await act(async () => { await chunk.load(); });
  expect(host.textContent).toBe("page");
  expect(calls).toBe(1);
});

it("retries the import after a failed load", async () => {
  let fail = true;
  const chunk = routeChunk(async () => {
    if (fail) throw new Error("offline");
    return { default: Page };
  });
  await expect(chunk.load()).rejects.toThrow("offline");
  fail = false;
  await expect(chunk.load()).resolves.toEqual({ default: Page });
});
