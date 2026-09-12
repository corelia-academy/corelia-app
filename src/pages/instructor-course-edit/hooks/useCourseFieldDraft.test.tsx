// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { useCourseFieldDraft } from "./useCourseFieldDraft";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it("preserves an unsaved co-instructor selection across server refresh and an earlier save", () => {
  let current: ReturnType<typeof useCourseFieldDraft<string[]>>;
  function Editor() {
    const draft = useCourseFieldDraft<string[]>("owner:course:coInstructors", []);
    useEffect(() => { current = draft; }, [draft]);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    act(() => root.render(<Editor />));
    act(() => current[2](["accepted"]));
    expect(current![4]).toBe(false);
    act(() => current[1](previous => [...previous, "new-selection"]));
    const submitted = current![0];
    act(() => current[2](["accepted"]));
    expect(current![0]).toEqual(["accepted", "new-selection"]);
    act(() => current[1](previous => [...previous, "later-selection"]));
    act(() => current[3](submitted));
    expect(current![4]).toBe(true);
    act(() => current[1](submitted));
    expect(current![4]).toBe(false);
  } finally { act(() => root.unmount()); }
});
