// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider, Routes, Route, useParams } from "react-router";
import { afterEach, expect, it } from "vitest";
import { useUnsavedLearning } from "./useUnsavedLearning";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function setup() {
  let dirty = true;
  let blocker: ReturnType<typeof useUnsavedLearning>;
  function Editor() {
    const currentBlocker = useUnsavedLearning(dirty);
    useEffect(() => { blocker = currentBlocker; }, [currentBlocker]);
    return <span>{useParams().id}</span>;
  }
  const router = createMemoryRouter([{ path: "*", element: <Routes>
    <Route path="/instructor/courses/:id/edit" element={<Editor />} />
    <Route path="*" element={<span>Other page</span>} />
  </Routes> }], { initialEntries: ["/instructor/courses", "/instructor/courses/course-1/edit"], initialIndex: 1 });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<RouterProvider router={router} />));
  cleanup = () => { act(() => root.unmount()); router.dispose(); host.remove(); };
  return { router, host, getBlocker: () => blocker!, clearDirty: async () => {
    dirty = false;
    await act(async () => { root.render(<RouterProvider router={router} />); await router.navigate("#changed"); });
  } };
}

it("retains editor and params across cancelled Back, then proceeds to the original destination", async () => {
  const { router, host, getBlocker } = setup();
  expect(host.textContent).toBe("course-1");
  await act(async () => { await router.navigate(-1); });
  expect(router.state.location.pathname).toBe("/instructor/courses/course-1/edit");
  expect(getBlocker().state).toBe("blocked");
  act(() => getBlocker().reset?.());
  expect(host.textContent).toBe("course-1");
  await act(async () => { await router.navigate(-1); });
  await act(async () => getBlocker().proceed?.());
  expect(router.state.location.pathname).toBe("/instructor/courses");
});

it("blocks programmatic push/replace and forward navigation, but permits same-page hashes", async () => {
  const { router, getBlocker } = setup();
  await act(async () => { await router.navigate("#content"); });
  expect(getBlocker().state).toBe("unblocked");
  await act(async () => { await router.navigate("/courses", { replace: true }); });
  expect(getBlocker().state).toBe("blocked");
  act(() => getBlocker().reset?.());
  await act(async () => { await router.navigate("/courses"); });
  await act(async () => getBlocker().proceed?.());
  await act(async () => { await router.navigate(-1); });
  await act(async () => { await router.navigate(1); });
  expect(getBlocker().state).toBe("blocked");
  expect(router.state.location.pathname).toBe("/instructor/courses/course-1/edit");
});

it("protects reload while dirty and releases the guard when changes are saved", async () => {
  const { router, clearDirty } = setup();
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await clearDirty();
  const cleanEvent = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(cleanEvent);
  expect(cleanEvent.defaultPrevented).toBe(false);
  await act(async () => { await router.navigate("/courses"); });
  expect(router.state.location.pathname).toBe("/courses");
});
